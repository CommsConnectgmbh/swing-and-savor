// Submitted Swing & Savor v1.0 zur App-Review.
//   1) reviewSubmission anlegen (oder bestehende finden)
//   2) reviewSubmissionItem mit appStoreVersion verlinken
//   3) PATCH submitted=true
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

(async () => {
  const appId = IDS.ascAppId;
  const versionId = IDS.ascVersionId;
  const PLATFORM = 'IOS';
  console.log('App:', appId, 'Version:', versionId);

  // [1] Open reviewSubmission finden oder erstellen
  console.log('\n[1] Existing reviewSubmissions ...');
  const existing = await http('GET',
    `/v1/reviewSubmissions?filter[app]=${appId}&filter[platform]=${PLATFORM}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES,COMPLETING&limit=5`);
  console.log('  status:', existing.status, '— count:', (existing.body?.data || []).length);

  let submissionId = (existing.body?.data || []).find(s =>
    ['READY_FOR_REVIEW', 'UNRESOLVED_ISSUES'].includes(s.attributes?.state))?.id;

  if (!submissionId) {
    console.log('\n[2] POST /v1/reviewSubmissions (neu) ...');
    const create = await http('POST', '/v1/reviewSubmissions', {
      data: {
        type: 'reviewSubmissions',
        attributes: { platform: PLATFORM },
        relationships: { app: { data: { type: 'apps', id: appId } } },
      },
    });
    console.log(' ', create.status, create.status >= 400 ? create.raw.slice(0, 500) : 'OK');
    if (create.status !== 201) process.exit(1);
    submissionId = create.body.data.id;
  } else {
    console.log('  reusing submission:', submissionId);
  }
  IDS.ascReviewSubmissionId = submissionId;
  fs.writeFileSync(IDS_PATH, JSON.stringify(IDS, null, 2));

  // [3] reviewSubmissionItem mit appStoreVersion verlinken
  console.log('\n[3] Items im Submission ...');
  const items = await http('GET',
    `/v1/reviewSubmissions/${submissionId}/items?limit=10`);
  console.log('  items:', items.body?.data?.length ?? 0);

  const hasVersion = (items.body?.data || []).some(i =>
    i.relationships?.appStoreVersion?.data?.id === versionId);

  if (!hasVersion) {
    console.log('  POST reviewSubmissionItem ...');
    const itemRes = await http('POST', '/v1/reviewSubmissionItems', {
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
          appStoreVersion:  { data: { type: 'appStoreVersions',  id: versionId } },
        },
      },
    });
    console.log(' ', itemRes.status, itemRes.status >= 400 ? itemRes.raw.slice(0, 500) : 'OK');
  } else {
    console.log('  Version bereits im Submission.');
  }

  // [4] Submit!
  console.log('\n[4] PATCH reviewSubmissions submitted=true ...');
  const submit = await http('PATCH', `/v1/reviewSubmissions/${submissionId}`, {
    data: { type: 'reviewSubmissions', id: submissionId,
      attributes: { submitted: true } },
  });
  console.log(' ', submit.status, submit.status >= 400 ? submit.raw.slice(0, 800) : 'OK');

  if (submit.status >= 400) {
    console.log('\n⚠️  Submit fehlgeschlagen. Häufige Ursachen:');
    console.log('  - App Privacy Form (Web-UI) noch nicht ausgefüllt');
    console.log('  - Build noch nicht VALID oder nicht verlinkt');
    console.log('  - Pflichtfelder im Listing leer (Categories, Age-Rating, Pricing)');
    process.exit(2);
  }

  console.log('\n✅ DONE. Build wartet jetzt im Review-Queue.');
})().catch(e => { console.error(e); process.exit(1); });
