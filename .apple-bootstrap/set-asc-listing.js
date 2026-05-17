// Setzt ASC-Listing-Texte + Categories + Content-Rights für Swing & Savor v1.0 (de-DE).
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
    algorithm: 'ES256', expiresIn: '15m',
    issuer: ASC_ISSUER, audience: 'appstoreconnect-v1',
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

const SUBTITLE       = 'Match Play, Duelle, Heimatclub';                       // ≤ 30
const PRIVACY_URL    = 'https://swingandsavor.at/datenschutz.html';
const MARKETING_URL  = 'https://swingandsavor.at';
const SUPPORT_URL    = 'https://swingandsavor.at';
const COPYRIGHT      = '© 2026 Comms Connect GmbH';

const PROMOTIONAL_TEXT =                                                       // ≤ 170
  'Singles, Doubles, Match Play. Tracke jede Runde, fordere Freunde, finde Heimatclubs in deiner Nähe.';

const KEYWORDS =                                                               // ≤ 100, comma-separated
  'Golf,Match Play,Turnier,Handicap,Scorecard,Golfclub,Duell,Runde,Caddie,Birdie,Eagle';

const DESCRIPTION = [
  'Swing & Savor — Golf-Turniere, Match Play und Duelle unter Freunden.',
  '',
  'Lege Runden, Turniere und Match-Play-Duelle an, tracke deine Schläge Loch für Loch und vergleiche dich mit Freunden — alles in einer schlanken App.',
  '',
  'WAS DU MACHEN KANNST',
  '- Turniere anlegen (Singles, Doubles, Team) mit eigenem 8-Zeichen-Invite-Code',
  '- Auto-Pair von Spielern nach Handicap',
  '- Live-Scorecard pro Loch mit Par/Handicap-Snapshot',
  '- Duelle (Challenges) an Freunde verschicken — Eingehend, Aktiv, Sent, Erledigt',
  '- Profil mit Match-Play-Stats (Win-Rate, Hole-Prozent)',
  '- Heimatclub setzen und in der Nähe befindliche Golfplätze finden',
  '- Freunde-System (Suche, Hinzufügen, Annehmen)',
  '',
  'KURSDATENBANK',
  'Über 1.700 Golfplätze vorab eingespielt (DE/AT/CH/ES/PT/AE/TR), inklusive OpenStreetMap-Nachladen für Plätze, die noch nicht in der Datenbank sind. Pars und Handicaps lassen sich pro Runde editieren und für alle anderen Spieler teilen.',
  '',
  'DSGVO & DATENSCHUTZ',
  '- Alle Daten in der EU (Supabase Frankfurt + Vercel EU)',
  '- Email-OTP-Login mit 8-stelligem Code, keine Magic-Links',
  '- Keine Werbung, kein Tracking, kein Analytics',
  '- Datenschutzerklärung: https://swingandsavor.at/datenschutz.html',
  '',
  'KONTAKT',
  'Anbieter: Comms Connect GmbH, München. HRB 295951 AG München.',
].join('\n');

async function findIds() {
  const appId = IDS.ascAppId;

  const appInfos = await http('GET', `/v1/apps/${appId}/appInfos`);
  const editableAppInfo = (appInfos.body?.data || [])
    .find(a => a.attributes?.state === 'PREPARE_FOR_SUBMISSION')
    || (appInfos.body?.data || [])[0];
  const appInfoId = editableAppInfo.id;

  const ailocs = await http('GET', `/v1/appInfos/${appInfoId}/appInfoLocalizations`);
  const deAppInfoLoc = (ailocs.body?.data || []).find(l => l.attributes?.locale === 'de-DE')
    || (ailocs.body?.data || [])[0];

  const versions = await http('GET', `/v1/apps/${appId}/appStoreVersions?limit=5`);
  const editableVersion = (versions.body?.data || [])
    .find(v => v.attributes?.appStoreState === 'PREPARE_FOR_SUBMISSION')
    || (versions.body?.data || [])[0];
  const versionId = editableVersion.id;

  const vlocs = await http('GET', `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`);
  const deVersionLoc = (vlocs.body?.data || []).find(l => l.attributes?.locale === 'de-DE')
    || (vlocs.body?.data || [])[0];

  return {
    appId, appInfoId,
    appInfoLocId: deAppInfoLoc.id,
    versionId,
    versionLocId: deVersionLoc.id,
  };
}

(async () => {
  const ids = await findIds();
  console.log('IDs:', ids);

  console.log('\n[1/5] AppInfoLocalization (de-DE) — Subtitle + Privacy-URL ...');
  const r1 = await http('PATCH', `/v1/appInfoLocalizations/${ids.appInfoLocId}`, {
    data: { type: 'appInfoLocalizations', id: ids.appInfoLocId,
      attributes: { subtitle: SUBTITLE, privacyPolicyUrl: PRIVACY_URL } },
  });
  console.log(' ', r1.status, r1.status >= 400 ? r1.raw : 'OK');

  console.log('\n[2/5] AppStoreVersionLocalization (de-DE) — Description, Keywords, URLs, Promo ...');
  const r2 = await http('PATCH', `/v1/appStoreVersionLocalizations/${ids.versionLocId}`, {
    data: { type: 'appStoreVersionLocalizations', id: ids.versionLocId,
      attributes: {
        description: DESCRIPTION,
        keywords: KEYWORDS,
        marketingUrl: MARKETING_URL,
        supportUrl: SUPPORT_URL,
        promotionalText: PROMOTIONAL_TEXT,
      } },
  });
  console.log(' ', r2.status, r2.status >= 400 ? r2.raw : 'OK');

  console.log('\n[3/5] AppStoreVersion — Copyright ...');
  const r3 = await http('PATCH', `/v1/appStoreVersions/${ids.versionId}`, {
    data: { type: 'appStoreVersions', id: ids.versionId,
      attributes: { copyright: COPYRIGHT } },
  });
  console.log(' ', r3.status, r3.status >= 400 ? r3.raw : 'OK');

  console.log('\n[4/5] AppInfo — Categories (SPORTS + LIFESTYLE) ...');
  const r4 = await http('PATCH', `/v1/appInfos/${ids.appInfoId}`, {
    data: { type: 'appInfos', id: ids.appInfoId,
      relationships: {
        primaryCategory:   { data: { type: 'appCategories', id: 'SPORTS' } },
        secondaryCategory: { data: { type: 'appCategories', id: 'LIFESTYLE' } },
      } },
  });
  console.log(' ', r4.status, r4.status >= 400 ? r4.raw : 'OK');

  console.log('\n[5/5] App — contentRightsDeclaration ...');
  const r5 = await http('PATCH', `/v1/apps/${ids.appId}`, {
    data: { type: 'apps', id: ids.appId,
      attributes: { contentRightsDeclaration: 'DOES_NOT_USE_THIRD_PARTY_CONTENT' } },
  });
  console.log(' ', r5.status, r5.status >= 400 ? r5.raw : 'OK');

  console.log('\n[persist] IDs in apple-ids.json ...');
  IDS.ascAppInfoId       = ids.appInfoId;
  IDS.ascAppInfoLocDeId  = ids.appInfoLocId;
  IDS.ascVersionId       = ids.versionId;
  IDS.ascVersionLocDeId  = ids.versionLocId;
  fs.writeFileSync(IDS_PATH, JSON.stringify(IDS, null, 2));
  console.log('  saved');

  console.log('\nDONE.');
})().catch(e => { console.error(e); process.exit(1); });
