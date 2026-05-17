// Setzt App Pricing auf "Free, alle Territorien" für Swing & Savor.
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

(async () => {
  console.log('Suche Free-PricePoint (USA, USD 0) ...');
  const pp = await http('GET',
    `/v1/apps/${IDS.ascAppId}/appPricePoints?filter[territory]=USA&limit=200`);
  if (pp.status !== 200) {
    console.error('  pricePoints lookup failed:', pp.status, pp.raw.slice(0, 300));
    process.exit(1);
  }
  const freePP = (pp.body?.data || []).find(p => {
    const cp = p.attributes?.customerPrice;
    return cp === '0' || cp === '0.0' || cp === '0.00' || Number(cp) === 0;
  });
  if (!freePP) {
    console.error('  no free price point in USA');
    process.exit(1);
  }
  console.log('  found free PP:', freePP.id);

  console.log('\nPOST /v1/appPriceSchedules (free, alle Territorien) ...');
  const r = await http('POST', '/v1/appPriceSchedules', {
    data: {
      type: 'appPriceSchedules',
      relationships: {
        app: { data: { type: 'apps', id: IDS.ascAppId } },
        baseTerritory: { data: { type: 'territories', id: 'USA' } },
        manualPrices: { data: [{ type: 'appPrices', id: '${freeNow}' }] },
      },
    },
    included: [
      {
        type: 'appPrices',
        id: '${freeNow}',
        attributes: { startDate: null },
        relationships: {
          appPricePoint: { data: { type: 'appPricePoints', id: freePP.id } },
        },
      },
    ],
  });
  console.log(' ', r.status, r.status >= 400 ? r.raw.slice(0, 500) : 'OK');
})().catch(e => { console.error(e); process.exit(1); });
