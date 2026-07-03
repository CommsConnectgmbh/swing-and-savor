// Fetch the current App Store provisioning profile for Swing & Savor from ASC
// and write it as a .mobileprovision. Resolves by profile NAME (the profile ID
// is regenerated whenever capabilities change — e.g. Push was added after the
// initial local export), so we never hardcode a stale ID.
//
// Usage: node fetch-profile.js [profileIdOrEmpty] [outPath]
const fs = require('fs');
const https = require('https');
const path = require('path');
const jwt = require('jsonwebtoken');
const { resolveSwingSavorAsc } = require('./lib/asc-env.js');

const { keyId, issuerId, keyPath } = resolveSwingSavorAsc();
const WANT_ID = process.argv[2] || '';
const OUT = process.argv[3] || '/tmp/SwingSavor_AppStore_current.mobileprovision';
const PROFILE_NAME = 'Swing and Savor v1.0 App Store';

function token() {
  return jwt.sign({}, fs.readFileSync(keyPath, 'utf8'), {
    algorithm: 'ES256', expiresIn: '10m', issuer: issuerId,
    audience: 'appstoreconnect-v1', header: { alg: 'ES256', kid: keyId, typ: 'JWT' },
  });
}
function api(p) {
  return new Promise((res, rej) => {
    https.request({ hostname: 'api.appstoreconnect.apple.com', path: p, method: 'GET',
      headers: { Authorization: 'Bearer ' + token(), Accept: 'application/json' } },
      r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, body: d })); })
      .on('error', rej).end();
  });
}

(async () => {
  let id = WANT_ID;
  if (!id) {
    const q = `/v1/profiles?filter[name]=${encodeURIComponent(PROFILE_NAME)}` +
              `&fields[profiles]=name,profileState,expirationDate&limit=50`;
    const r = await api(q);
    if (r.status !== 200) { console.error('ASC list error', r.status, r.body.slice(0, 400)); process.exit(1); }
    const active = (JSON.parse(r.body).data || []).filter(p => p.attributes.profileState === 'ACTIVE');
    if (!active.length) { console.error('No ACTIVE profile named', PROFILE_NAME); process.exit(1); }
    id = active[0].id;
  }
  const r = await api(`/v1/profiles/${id}?fields[profiles]=name,profileState,profileContent,expirationDate,uuid`);
  if (r.status !== 200) { console.error('ASC get error', r.status, r.body.slice(0, 400)); process.exit(1); }
  const a = JSON.parse(r.body).data.attributes;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(a.profileContent, 'base64'));
  console.log(`profile: ${a.name} | id=${id} | ${a.profileState} | exp=${a.expirationDate} | uuid=${a.uuid}`);
  console.log('written:', OUT);
})();
