// Probe-Script: welche App-Privacy-Endpunkte sind aktuell aktiv?
const fs = require('fs');
const path = require('path');
const https = require('https');
const jwt = require('jsonwebtoken');
const { resolveSwingSavorAsc } = require('./lib/asc-env');
const { keyId, issuerId, keyPath } = resolveSwingSavorAsc();
const IDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'secrets', 'apple-ids.json'), 'utf8'));

function token() {
  return jwt.sign({}, fs.readFileSync(keyPath, 'utf8'), {
    algorithm: 'ES256', expiresIn: '15m', issuer: issuerId, audience: 'appstoreconnect-v1',
    header: { alg: 'ES256', kid: keyId, typ: 'JWT' },
  });
}
function get(p) {
  return new Promise((res, rej) => {
    https.request({
      hostname: 'api.appstoreconnect.apple.com', path: p, method: 'GET',
      headers: { Authorization: 'Bearer ' + token() },
    }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => res({ s: r.statusCode, b: d }));
    }).on('error', rej).end();
  });
}

(async () => {
  const ID = IDS.ascAppId;
  const PROBES = [
    `/v1/apps/${ID}/appPrivacyDetails`,
    `/v1/apps/${ID}/appPrivacyDetail`,
    `/v1/apps/${ID}/dataUsages`,
    `/v1/apps/${ID}/appDataUsages`,
    `/v1/apps/${ID}/appDataUsagePublishings`,
    `/v1/apps/${ID}/appPrivacyDetailPublishings`,
    `/v1/appPrivacyDetails`,
    `/v1/appDataUsageDataProtections`,
    `/v1/appDataUsagePurposes`,
    `/v1/appDataUsageCategories`,
    `/v1/dataUsageCategories`,
    `/v1/dataProtections`,
    // Apple's neue: "App Privacy Notice"
    `/v1/apps/${ID}/appAvailability`,
    `/v1/apps/${ID}/appAvailabilityV2`,
    // Per ASC-Web-Trace
    `/v1/apps/${ID}/appPrivacyDataCollectionTypes`,
    `/v1/apps/${ID}/appPrivacyDataCollections`,
  ];
  for (const p of PROBES) {
    const r = await get(p);
    console.log(r.s, p, r.s >= 400 ? r.b.slice(0, 150).replace(/\s+/g, ' ') : 'OK ' + r.b.slice(0, 200).replace(/\s+/g, ' '));
  }
})().catch(e => { console.error(e); process.exit(1); });
