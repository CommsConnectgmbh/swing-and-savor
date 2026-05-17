// Sucht den ASC-App-Record für de.commsconnect.swingandsavor und ergänzt apple-ids.json.
// Apple-API erlaubt kein POST /v1/apps, deshalb muss der App-Record manuell
// in App Store Connect angelegt werden bevor dieses Script läuft.
const fs    = require('fs');
const path  = require('path');
const https = require('https');
const jwt   = require('jsonwebtoken');

const { resolveSwingSavorAsc } = require('./lib/asc-env');
const { keyId: ASC_KEY_ID, issuerId: ASC_ISSUER, keyPath: ASC_KEY_PATH } = resolveSwingSavorAsc();
const BUNDLE_ID    = 'de.commsconnect.swingandsavor';

const SECRETS_DIR = path.join(__dirname, 'secrets');
const IDS_FILE    = path.join(SECRETS_DIR, 'apple-ids.json');

function appleJWT() {
  const p8 = fs.readFileSync(ASC_KEY_PATH, 'utf8');
  return jwt.sign({}, p8, {
    algorithm: 'ES256', expiresIn: '15m',
    issuer: ASC_ISSUER, audience: 'appstoreconnect-v1',
    header: { alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' },
  });
}

function appleAPI(method, p) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.appstoreconnect.apple.com', path: p, method,
      headers: { Authorization: 'Bearer ' + appleJWT(), Accept: 'application/json' },
    }, res => {
      let buf = ''; res.on('data', c => buf += c);
      res.on('end', () => {
        const ct = res.headers['content-type'] || '';
        let parsed = buf;
        if (ct.includes('json') && buf) { try { parsed = JSON.parse(buf); } catch (e) {} }
        resolve({ status: res.statusCode, body: parsed, raw: buf });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  console.log('Searching ASC for', BUNDLE_ID, '...');
  const r = await appleAPI('GET',
    '/v1/apps?filter%5BbundleId%5D=' + encodeURIComponent(BUNDLE_ID));
  if (r.status !== 200) {
    console.error('  failed', r.status, r.raw);
    process.exit(1);
  }
  const app = (r.body?.data || [])[0];
  if (!app) {
    console.log('');
    console.log('NOT FOUND. Create the App-Record manually:');
    console.log('  1. https://appstoreconnect.apple.com/apps -> "+" -> New App');
    console.log('  2. Platform: iOS');
    console.log('  3. Name: Swing & Savor');
    console.log('  4. Primary Language: German (de-DE)');
    console.log('  5. Bundle ID: de.commsconnect.swingandsavor (Dropdown)');
    console.log('  6. SKU: SWINGSAVOR-IOS-001');
    console.log('  7. User Access: Full Access');
    console.log('  8. "Create"');
    console.log('');
    console.log('Then re-run: node create-asc-app.js');
    process.exit(2);
  }
  console.log('   ASC App ID:', app.id);
  console.log('   Name:', app.attributes.name);
  console.log('   SKU:', app.attributes.sku);

  const ids = JSON.parse(fs.readFileSync(IDS_FILE, 'utf8'));
  ids.ascAppId = app.id;
  ids.ascAppName = app.attributes.name;
  ids.ascAppSku = app.attributes.sku;
  fs.writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2));
  console.log('   updated:', path.relative(process.cwd(), IDS_FILE));
})().catch(e => { console.error(e); process.exit(1); });
