// Setzt TestFlight Internal Testing für Swing & Savor auf:
//   1. Beta App Localization (de-DE) + Beta App Review Info
//   2. Internal Group anlegen falls fehlt, Tester (Rainer) hinzufügen
//   3. Build mit Internal Group verlinken (sodass Tester den Build sehen)
const fs = require('fs');
const path = require('path');
const https = require('https');
const jwt = require('jsonwebtoken');

const { resolveSwingSavorAsc } = require('./lib/asc-env');
const { keyId: ASC_KEY_ID, issuerId: ASC_ISSUER, keyPath: ASC_KEY_PATH } = resolveSwingSavorAsc();
const IDS_PATH = path.join(__dirname, 'secrets', 'apple-ids.json');
const IDS = JSON.parse(fs.readFileSync(IDS_PATH, 'utf8'));

function appleJWT() {
  return jwt.sign({}, fs.readFileSync(ASC_KEY_PATH, 'utf8'), {
    algorithm: 'ES256', expiresIn: '15m', issuer: ASC_ISSUER, audience: 'appstoreconnect-v1',
    header: { alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' },
  });
}

function http(method, p, body) {
  const bodyStr = body ? JSON.stringify(body) : null;
  return new Promise((res, rej) => {
    const req = https.request({
      hostname: 'api.appstoreconnect.apple.com', path: p, method,
      headers: {
        Authorization: 'Bearer ' + appleJWT(), Accept: 'application/json',
        ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => {
        let parsed = d; try { parsed = d ? JSON.parse(d) : null; } catch (e) {}
        res({ status: r.statusCode, body: parsed, raw: d });
      });
    });
    req.on('error', rej);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

const TESTER_EMAIL = process.env.TESTER_EMAIL || 'rainer.roloff@comms-connect.de';
const TESTER_FIRST = 'Rainer';
const TESTER_LAST  = 'Roloff';

(async () => {
  const appId = IDS.ascAppId;
  const buildId = IDS.ascBuildId;
  console.log('App:', appId, 'Build:', buildId, 'Tester:', TESTER_EMAIL);

  // [1/5] Beta App Localization (de-DE)
  console.log('\n[1/5] Beta App Localizations (de-DE) ...');
  const balRes = await http('GET', `/v1/apps/${appId}/betaAppLocalizations`);
  const existingDe = (balRes.body?.data || []).find(l => l.attributes?.locale === 'de-DE');
  const balAttr = {
    description: 'Swing & Savor — Golf-Turniere, Match Play und Duelle unter Freunden.',
    feedbackEmail: 'rainer.roloff@comms-connect.de',
    marketingUrl: 'https://swingandsavor.at',
    privacyPolicyUrl: 'https://swingandsavor.at/datenschutz.html',
    tvOsPrivacyPolicy: null,
  };
  if (existingDe) {
    const r = await http('PATCH', `/v1/betaAppLocalizations/${existingDe.id}`, {
      data: { type: 'betaAppLocalizations', id: existingDe.id, attributes: balAttr },
    });
    console.log(' PATCH', r.status, r.status >= 400 ? r.raw : 'OK');
  } else {
    const r = await http('POST', '/v1/betaAppLocalizations', {
      data: {
        type: 'betaAppLocalizations',
        attributes: { locale: 'de-DE', ...balAttr },
        relationships: { app: { data: { type: 'apps', id: appId } } },
      },
    });
    console.log(' POST', r.status, r.status >= 400 ? r.raw : 'OK');
  }

  // [2/5] Beta App Review Detail (Contact für Beta-Submission)
  console.log('\n[2/5] Beta App Review Detail (Contact) ...');
  const barRes = await http('GET', `/v1/apps/${appId}/betaAppReviewDetail`);
  const reviewDetailId = barRes.body?.data?.id;
  const barAttr = {
    contactFirstName: TESTER_FIRST,
    contactLastName: TESTER_LAST,
    contactPhone: '+49 89 4522 1556',
    contactEmail: TESTER_EMAIL,
    demoAccountName: null,
    demoAccountPassword: null,
    demoAccountRequired: false,
    notes: 'Email-OTP-Login mit eigener Email — Tester gibt eigene Email ein, 8-stelliger Code per Mail.',
  };
  if (reviewDetailId) {
    const r = await http('PATCH', `/v1/betaAppReviewDetails/${reviewDetailId}`, {
      data: { type: 'betaAppReviewDetails', id: reviewDetailId, attributes: barAttr },
    });
    console.log(' PATCH', r.status, r.status >= 400 ? r.raw : 'OK');
  }

  // [3/5] Beta Group (Internal) anlegen oder finden
  console.log('\n[3/5] Beta Group "Internal Testing" ...');
  const bgRes = await http('GET',
    `/v1/apps/${appId}/betaGroups?filter[isInternalGroup]=true&limit=10`);
  let group = (bgRes.body?.data || []).find(g => g.attributes?.isInternalGroup);
  if (!group) {
    const r = await http('POST', '/v1/betaGroups', {
      data: {
        type: 'betaGroups',
        attributes: {
          name: 'Internal Testing',
          isInternalGroup: true,
          publicLinkEnabled: false,
        },
        relationships: { app: { data: { type: 'apps', id: appId } } },
      },
    });
    if (r.status !== 201) {
      console.error(' Group create failed:', r.status, r.raw);
      process.exit(1);
    }
    group = r.body.data;
    console.log(' Created group:', group.id);
  } else {
    console.log(' Existing group:', group.id, group.attributes.name);
  }
  IDS.ascInternalGroupId = group.id;

  // [4/5] Tester anlegen/finden + zur Group hinzufügen
  console.log('\n[4/5] Beta Tester:', TESTER_EMAIL, '...');
  const btRes = await http('GET',
    `/v1/betaTesters?filter[email]=${encodeURIComponent(TESTER_EMAIL)}&limit=5`);
  let tester = (btRes.body?.data || []).find(t => t.attributes?.email === TESTER_EMAIL);
  if (!tester) {
    const r = await http('POST', '/v1/betaTesters', {
      data: {
        type: 'betaTesters',
        attributes: { email: TESTER_EMAIL, firstName: TESTER_FIRST, lastName: TESTER_LAST },
        relationships: {
          betaGroups: { data: [{ type: 'betaGroups', id: group.id }] },
        },
      },
    });
    if (r.status === 201) {
      tester = r.body.data;
      console.log(' Created tester:', tester.id);
    } else if (r.status === 409 || /already/i.test(r.raw)) {
      console.log(' Tester exists (409). Querying again ...');
      const again = await http('GET',
        `/v1/betaTesters?filter[email]=${encodeURIComponent(TESTER_EMAIL)}&limit=5`);
      tester = (again.body?.data || [])[0];
    } else {
      console.error(' Tester create failed:', r.status, r.raw);
    }
  } else {
    console.log(' Existing tester:', tester.id);
  }

  // Ensure tester is in the group (POST betaTesters/{id}/relationships/betaGroups)
  if (tester) {
    const link = await http('POST',
      `/v1/betaTesters/${tester.id}/relationships/betaGroups`, {
        data: [{ type: 'betaGroups', id: group.id }],
      });
    console.log(' Link tester→group:', link.status, link.status >= 400 ? link.raw.slice(0, 200) : 'OK');
  }

  // [5/5] Build mit Group verlinken
  console.log('\n[5/5] Link build', buildId, 'to group ...');
  const buildLink = await http('POST',
    `/v1/builds/${buildId}/relationships/betaGroups`, {
      data: [{ type: 'betaGroups', id: group.id }],
    });
  console.log(' ', buildLink.status, buildLink.status >= 400 ? buildLink.raw.slice(0, 200) : 'OK');

  fs.writeFileSync(IDS_PATH, JSON.stringify(IDS, null, 2));
  console.log('\nDONE. TestFlight Internal Testing aktiv für', TESTER_EMAIL);
})().catch(e => { console.error(e); process.exit(1); });
