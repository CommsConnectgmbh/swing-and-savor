// Setzt App Privacy Form für Swing & Savor via Apple API.
//
// Datenarten die Swing & Savor sammelt:
//   - EMAIL_ADDRESS    (Auth)              — Linked, App Functionality
//   - NAME             (Display-Name)      — Linked, App Functionality
//   - USER_ID          (Supabase user UUID)— Linked, App Functionality
//   - COARSE_LOCATION  (Course-Nearby)     — Linked, App Functionality
//
// API-Pattern:
//   1. POST /v1/appDataUsagePublishings  → Privacy-Form für die App öffnen
//   2. POST /v1/appDataUsages            → pro (category, dataProtections, purpose)
//   3. POST /v1/appDataUsagePublishings  → publish

const fs = require('fs');
const path = require('path');
const https = require('https');
const jwt = require('jsonwebtoken');

const { resolveSwingSavorAsc } = require('./lib/asc-env');
const { keyId: ASC_KEY_ID, issuerId: ASC_ISSUER, keyPath: ASC_KEY_PATH } = resolveSwingSavorAsc();
const IDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'secrets', 'apple-ids.json'), 'utf8'));

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

// Datenkategorien, Schutzklassen + Zwecke
// Apple-API-IDs sind Strings wie "EMAIL_ADDRESS", "NAME", "COARSE_LOCATION", "USER_ID"
// dataProtection: LINKED_TO_USER + NOT_USED_FOR_TRACKING
// purpose: APP_FUNCTIONALITY
const COLLECTED = [
  { category: 'EMAIL_ADDRESS', label: 'Email Address (Contact Info)' },
  { category: 'NAME', label: 'Name (Contact Info)' },
  { category: 'USER_ID', label: 'User ID (Identifiers)' },
  { category: 'COARSE_LOCATION', label: 'Coarse Location (Course-Nearby)' },
];

(async () => {
  const appId = IDS.ascAppId;

  // 1) Existing dataUsages prüfen
  console.log('[1] Existing appDataUsages für App', appId, '...');
  const existing = await http('GET', `/v1/apps/${appId}/dataUsages?limit=200`);
  console.log('    Status', existing.status, '— existing entries:',
    (existing.body?.data || []).length);
  if (existing.status >= 400) {
    console.log('    Endpoint /apps/{id}/dataUsages nicht verfügbar — Fallback auf appPrivacyDetails');
  }

  // 2) Existing entries löschen (idempotent)
  for (const old of (existing.body?.data || [])) {
    const del = await http('DELETE', `/v1/appDataUsages/${old.id}`);
    console.log('    DELETE existing', old.id, '->', del.status);
  }

  // 3) Neue dataUsages anlegen — pro Kategorie 3 Entries:
  //    - Category-Entry (was wir sammeln)
  //    - DataProtection LINKED_TO_USER
  //    - Purpose APP_FUNCTIONALITY
  console.log('\n[2] Lege appDataUsages an ...');
  for (const item of COLLECTED) {
    console.log(`  • ${item.label}`);
    for (const usageType of [item.category, 'LINKED_TO_USER', 'APP_FUNCTIONALITY']) {
      const r = await http('POST', '/v1/appDataUsages', {
        data: {
          type: 'appDataUsages',
          relationships: {
            app: { data: { type: 'apps', id: appId } },
            category: { data: { type: 'appDataUsageCategories', id: usageType } },
          },
        },
      });
      console.log(`    POST ${usageType} ->`, r.status,
        r.status >= 400 ? r.raw.slice(0, 250) : 'OK');
    }
  }

  // 4) "Does not collect data" Flag setzen (false, da wir sammeln)
  // Actually we collect → POST appDataUsagesPublishing
  console.log('\n[3] Publish App Privacy Details ...');
  const pub = await http('POST', '/v1/appDataUsagePublishings', {
    data: {
      type: 'appDataUsagePublishings',
      relationships: {
        app: { data: { type: 'apps', id: appId } },
      },
    },
  });
  console.log(' ', pub.status, pub.status >= 400 ? pub.raw.slice(0, 400) : 'OK');
})().catch(e => { console.error(e); process.exit(1); });
