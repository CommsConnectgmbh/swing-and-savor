// Pollt ASC bis Build 1.0/1 processed ist, dann setzt usesNonExemptEncryption=false
// (Export-Compliance) damit Build für TestFlight verfügbar wird.
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const appId = IDS.ascAppId;
  const MAX_MINUTES = 30;
  const POLL_SEC = 30;

  for (let i = 0; i < (MAX_MINUTES * 60) / POLL_SEC; i++) {
    const r = await http('GET',
      `/v1/builds?filter[app]=${appId}&filter[version]=1&filter[preReleaseVersion.version]=1.0&limit=5&sort=-uploadedDate`);
    const builds = r.body?.data || [];
    const build = builds.find(b => b.attributes?.version === '1' && b.attributes?.processingState);
    if (build) {
      const state = build.attributes.processingState;
      const exp = build.attributes.expirationDate;
      console.log(`[${new Date().toISOString()}] build ${build.id} state=${state} expires=${exp}`);
      if (state === 'VALID') {
        IDS.ascBuildId = build.id;
        IDS.ascBuildUsesEncryption = build.attributes.usesNonExemptEncryption;
        fs.writeFileSync(IDS_PATH, JSON.stringify(IDS, null, 2));

        if (build.attributes.usesNonExemptEncryption === null) {
          console.log('\nSet usesNonExemptEncryption=false (Export Compliance) ...');
          const ec = await http('PATCH', `/v1/builds/${build.id}`, {
            data: { type: 'builds', id: build.id,
              attributes: { usesNonExemptEncryption: false } },
          });
          console.log(' ', ec.status, ec.status >= 400 ? ec.raw : 'OK');
        }
        console.log('\nDONE. Build ist VALID + Export-Compliance gesetzt.');
        process.exit(0);
      }
      if (state === 'FAILED' || state === 'INVALID') {
        console.error('Build failed processing:', build);
        process.exit(1);
      }
    } else {
      console.log(`[${new Date().toISOString()}] no build yet (${builds.length} total builds returned)`);
    }
    await sleep(POLL_SEC * 1000);
  }
  console.error(`Timeout nach ${MAX_MINUTES} Min — Build noch nicht VALID.`);
  process.exit(2);
})().catch(e => { console.error(e); process.exit(1); });
