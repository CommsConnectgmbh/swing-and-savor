// Setzt Age Rating Declaration für Swing & Savor (4+, Sport/Lifestyle).
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
  const ageRatingId = IDS.ascAppInfoId; // selbe UUID wie AppInfo
  console.log('Age Rating Declaration PATCH ...');
  const r = await http('PATCH', `/v1/ageRatingDeclarations/${ageRatingId}`, {
    data: {
      type: 'ageRatingDeclarations',
      id: ageRatingId,
      attributes: {
        alcoholTobaccoOrDrugUseOrReferences: 'NONE',
        contests: 'NONE',
        gamblingSimulated: 'NONE',
        gunsOrOtherWeapons: 'NONE',
        horrorOrFearThemes: 'NONE',
        matureOrSuggestiveThemes: 'NONE',
        medicalOrTreatmentInformation: 'NONE',
        profanityOrCrudeHumor: 'NONE',
        sexualContentGraphicAndNudity: 'NONE',
        sexualContentOrNudity: 'NONE',
        violenceCartoonOrFantasy: 'NONE',
        violenceRealisticProlongedGraphicOrSadistic: 'NONE',
        violenceRealistic: 'NONE',
        unrestrictedWebAccess: true,   // WebView auf app.swingandsavor.at
        gambling: false,
        userGeneratedContent: false,
        messagingAndChat: false,
        ageRatingOverride: 'NONE',
        advertising: false,
        ageAssurance: false,
        parentalControls: false,
        lootBox: false,
        healthOrWellnessTopics: false,
      },
    },
  });
  console.log(' ', r.status, r.status >= 400 ? r.raw : 'OK');
})().catch(e => { console.error(e); process.exit(1); });
