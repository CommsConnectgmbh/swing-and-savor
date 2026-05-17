// Apple-iOS-Credentials-Bootstrap für Swing & Savor.
//
// Apple-Limit: max 2 aktive IOS_DISTRIBUTION Certs pro Team. Comms Connect GmbH
// hat schon DealBuddy + Obacht. Swing & Savor reused Obachts Distribution Cert
// — Cert ist app-agnostisch, identifiziert nur den Team.
//
// Was das Skript macht:
//   1) Verifiziert reused Distribution Cert (Obacht)
//   2) Erstellt Bundle ID `de.commsconnect.swingandsavor` + ASSOCIATED_DOMAINS
//   3) Erstellt Provisioning Profile "Swing and Savor v1.0 App Store"
//   4) Schreibt Profile + P12 + IDs nach ./secrets/ (gitignored)
//
// Voraussetzungen:
//   - Comms-Connect-Team-ID U7CT3BQ7HY
//   - Swing-&-Savor ASC API Key (manuell in ASC angelegt, .p8 unter
//     /Volumes/Code/Projects/swing-and-savor/.local-secrets/AuthKey_<KEYID>.p8)
//   - Obacht-P12 als Cert-Source (Cert ist app-agnostisch)
const fs    = require('fs');
const path  = require('path');
const https = require('https');
const jwt   = require('jsonwebtoken');
const { resolveSwingSavorAsc } = require('./lib/asc-env');

const { keyId: ASC_KEY_ID, issuerId: ASC_ISSUER, keyPath: ASC_KEY_PATH } = resolveSwingSavorAsc();
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID || 'U7CT3BQ7HY';

const BUNDLE_ID    = 'de.commsconnect.swingandsavor';
const APP_NAME     = 'Swing and Savor'; // Apple lehnt '&' in bundleId.name ab
const PROFILE_NAME = 'Swing and Savor v1.0 App Store';

// Reuse Obacht Distribution Cert (Apple-Cert ist app-agnostisch)
const REUSED_CERT_ID = process.env.REUSED_CERT_ID || '2T3UADV229';
const REUSED_P12_PATH = process.env.REUSED_P12_PATH ||
  '/Volumes/Code/Projects/Obacht/.apple-bootstrap/secrets/obacht-distribution.p12';
const REUSED_P12_PASSWORD = process.env.REUSED_P12_PASSWORD ||
  JSON.parse(fs.readFileSync(
    '/Volumes/Code/Projects/Obacht/.apple-bootstrap/secrets/apple-ids.json', 'utf8'
  )).p12Password;

const OUT_DIR = path.join(__dirname, 'secrets');
fs.mkdirSync(OUT_DIR, { recursive: true });

function appleJWT() {
  const p8 = fs.readFileSync(ASC_KEY_PATH, 'utf8');
  return jwt.sign({}, p8, {
    algorithm: 'ES256', expiresIn: '15m',
    issuer: ASC_ISSUER, audience: 'appstoreconnect-v1',
    header: { alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' },
  });
}

function httpJson(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      let buf = ''; res.on('data', c => buf += c);
      res.on('end', () => {
        const ct = res.headers['content-type'] || '';
        let parsed = buf;
        if (ct.includes('json') && buf) { try { parsed = JSON.parse(buf); } catch (e) {} }
        resolve({ status: res.statusCode, body: parsed, raw: buf });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function appleAPI(method, p, jsonBody) {
  const body = jsonBody ? JSON.stringify(jsonBody) : null;
  return httpJson({
    hostname: 'api.appstoreconnect.apple.com', path: p, method,
    headers: {
      Authorization: 'Bearer ' + appleJWT(),
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
    },
  }, body);
}

function writeFile(name, data) {
  const p = path.join(OUT_DIR, name);
  fs.writeFileSync(p, data);
  console.log('   saved:', path.relative(process.cwd(), p));
}

(async () => {
  console.log('Swing & Savor Apple Bootstrap');
  console.log('  Bundle ID:', BUNDLE_ID);
  console.log('  Apple Team:', APPLE_TEAM_ID);
  console.log('  Reusing Cert:', REUSED_CERT_ID, '(Obacht distribution)');
  console.log('');

  // [1/4] Verify cert exists + is valid
  console.log('[1/4] Apple: verify reused distribution cert ...');
  const certCheck = await appleAPI('GET', `/v1/certificates/${REUSED_CERT_ID}`);
  if (certCheck.status !== 200) {
    console.error('  cert lookup failed:', certCheck.status, certCheck.raw);
    console.error('  TIP: list active certs via GET /v1/certificates und update REUSED_CERT_ID');
    process.exit(1);
  }
  const certName = certCheck.body.data.attributes.name;
  const certType = certCheck.body.data.attributes.certificateType;
  const certExpires = certCheck.body.data.attributes.expirationDate;
  console.log('   ok:', certName, '(' + certType + '), expires', certExpires);

  // [2/4] Bundle ID create-or-reuse
  console.log('[2/4] Apple: ensure bundle id', BUNDLE_ID, '...');
  let appleBundleIdId;
  const listRes = await appleAPI('GET',
    '/v1/bundleIds?filter%5Bidentifier%5D=' + encodeURIComponent(BUNDLE_ID));
  const found = (listRes.body?.data || []).find(b => b.attributes?.identifier === BUNDLE_ID);
  if (found) {
    appleBundleIdId = found.id;
    console.log('   bundle id exists:', appleBundleIdId);
  } else {
    const r = await appleAPI('POST', '/v1/bundleIds', {
      data: { type: 'bundleIds',
        attributes: { identifier: BUNDLE_ID, name: APP_NAME, platform: 'IOS' } },
    });
    if (r.status !== 201) {
      console.error('  bundle id create failed', r.status, r.raw);
      process.exit(1);
    }
    appleBundleIdId = r.body.data.id;
    console.log('   bundle id created:', appleBundleIdId);
  }

  // ASSOCIATED_DOMAINS für Universal Links (swingandsavor.at + app.swingandsavor.at)
  for (const capType of ['ASSOCIATED_DOMAINS']) {
    const r = await appleAPI('POST', '/v1/bundleIdCapabilities', {
      data: {
        type: 'bundleIdCapabilities',
        attributes: { capabilityType: capType, settings: [] },
        relationships: { bundleId: { data: { type: 'bundleIds', id: appleBundleIdId } } },
      },
    });
    console.log('    capability', capType, '->', r.status);
  }

  // [3/4] Profile create-or-reuse
  console.log('[3/4] Apple: ensure provisioning profile "' + PROFILE_NAME + '" ...');
  let appleProfileId;
  let profileBase64;
  const profListRes = await appleAPI('GET',
    '/v1/profiles?filter%5Bname%5D=' + encodeURIComponent(PROFILE_NAME) + '&include=bundleId');
  const existingProfile = (profListRes.body?.data || []).find(p =>
    p.attributes?.name === PROFILE_NAME && p.attributes?.profileState === 'ACTIVE'
  );
  if (existingProfile) {
    appleProfileId = existingProfile.id;
    profileBase64 = existingProfile.attributes.profileContent;
    console.log('   profile exists:', appleProfileId);
  } else {
    const profRes = await appleAPI('POST', '/v1/profiles', {
      data: {
        type: 'profiles',
        attributes: { name: PROFILE_NAME, profileType: 'IOS_APP_STORE' },
        relationships: {
          bundleId:     { data: { type: 'bundleIds',   id: appleBundleIdId } },
          certificates: { data: [{ type: 'certificates', id: REUSED_CERT_ID }] },
        },
      },
    });
    if (profRes.status !== 201) {
      console.error('  profile create failed', profRes.status,
        JSON.stringify(profRes.body, null, 2).slice(0, 2000));
      process.exit(1);
    }
    appleProfileId = profRes.body.data.id;
    profileBase64  = profRes.body.data.attributes.profileContent;
    console.log('   profile created:', appleProfileId);
  }
  writeFile('SwingSavor_AppStore.mobileprovision', Buffer.from(profileBase64, 'base64'));

  // Copy reused P12 für self-contained GH-Secrets-Upload
  fs.copyFileSync(REUSED_P12_PATH, path.join(OUT_DIR, 'swingsavor-distribution.p12'));
  console.log('   copied reused P12 to:', path.join(OUT_DIR, 'swingsavor-distribution.p12'));

  // [4/4] Write summary
  console.log('[4/4] Writing summary ...');
  const summary = {
    bundleId: BUNDLE_ID,
    appName: APP_NAME,
    appleTeamId: APPLE_TEAM_ID,
    appleBundleIdId,
    appleCertId: REUSED_CERT_ID,
    appleProfileId,
    profileName: PROFILE_NAME,
    p12Password: REUSED_P12_PASSWORD,
    certNote: 'Reuses Obacht distribution cert (cert is app-agnostic per Apple).',
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'apple-ids.json'),
    JSON.stringify(summary, null, 2));
  console.log('   saved: apple-ids.json');

  console.log('');
  console.log('DONE. Files in', OUT_DIR);
  console.log('');
  console.log('Next:');
  console.log('  1. Manual: App-Record in App Store Connect anlegen (siehe README)');
  console.log('  2. node create-asc-app.js   # holt ASC App-ID');
  console.log('  3. node set-gh-secrets.js   # uploads 7 GH-Actions-Secrets');
  console.log('  4. git tag ios-v1.0.0 && git push origin ios-v1.0.0');
})().catch(e => { console.error(e); process.exit(1); });
