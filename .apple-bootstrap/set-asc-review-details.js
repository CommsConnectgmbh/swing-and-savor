// Setzt App Review Details (Demo-Account, Notes, Contact) für Swing & Savor.
// Nutzt den Reviewer-Bypass aus supabase/functions/reviewer-bypass:
//   - apple-review@swingandsavor.at + Code 87654321
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

const DEMO_EMAIL    = 'apple-review@swingandsavor.at';
const DEMO_PASSWORD = '87654321';

const NOTES = `Swing & Savor ist ein nativer Capacitor-Container für die unter https://app.swingandsavor.at gehostete Progressive Web App.

REVIEWER-LOGIN (Bypass für Email-OTP)

Die App nutzt Email-OTP-Login (8-stelliger Code per Mail). Damit Apple-Reviewer ohne Mailbox-Zugriff testen können, ist ein Reviewer-Bypass implementiert:

  E-Mail: ${DEMO_EMAIL}
  Code:   ${DEMO_PASSWORD}

Login-Flow:
1) Auf dem Login-Screen die obige E-Mail eingeben → "Code anfordern"
2) Im OTP-Eingabefeld den Code ${DEMO_PASSWORD} eintippen → eingeloggt

Der Bypass läuft über die Supabase Edge Function "reviewer-bypass" — kein echter SMTP-Versand, kein Wartezeit, der Account wird beim ersten Login serverseitig angelegt.

WAS DER REVIEWER TESTEN KANN

- Onboarding (Handle, Display-Name, Handicap setzen)
- Board: Turnier anlegen, beitreten via 8-Zeichen-Code, Live-Scoring
- Match-Detail: Loch-für-Loch Scoring mit Par/Handicap aus Kursdatenbank
- Course-Picker: Heimatclub setzen, "In der Nähe" (Location-Permission triggert beim ersten Tap)
- Discover: öffentliche Turniere joinen
- Duelle / Challenges: an Freunde verschicken (DealBuddy-Cross-Link Button öffnet externe App falls installiert)
- Profil: Match-Play-Stats, Konto-Löschung (DSGVO Art. 17)

DATEN-COMPLIANCE

- Server in der EU (Supabase Frankfurt + Vercel EU)
- Email-OTP-Login mit 8-stelligem Code, keine Magic-Links
- Keine Werbung, kein Tracking, kein Analytics-SDK
- Standort nur bei expliziter User-Aktion ("Plätze in der Nähe")
- Konto-Löschung in der App (Profil → "Konto unwiderruflich löschen")
- Datenschutzerklärung: https://swingandsavor.at/datenschutz.html

ZIELGRUPPE

Hobby-Golfer und Golfclub-Communities im DACH-Raum. Match Play und Duelle stehen im Mittelpunkt — keine Wett-Mechanik in der App selbst (rechtlich saubere Trennung von DealBuddy-Funktionalität).`;

(async () => {
  const versionId = IDS.ascVersionId;
  console.log('Version:', versionId);

  const existing = await http('GET', `/v1/appStoreVersions/${versionId}/appStoreReviewDetail`);
  console.log('  existing review detail:', existing.status, existing.body?.data ? 'YES' : 'NO');

  const detailExists = !!existing.body?.data;
  const detailId = existing.body?.data?.id;

  const attributes = {
    contactFirstName: 'Rainer',
    contactLastName: 'Roloff',
    contactPhone: '+49 89 4522 1556',
    contactEmail: 'rainer.roloff@comms-connect.de',
    demoAccountName: DEMO_EMAIL,
    demoAccountPassword: DEMO_PASSWORD,
    demoAccountRequired: true,
    notes: NOTES,
  };

  let r;
  if (detailExists) {
    console.log('\nPATCH AppStoreReviewDetail ...');
    r = await http('PATCH', `/v1/appStoreReviewDetails/${detailId}`, {
      data: { type: 'appStoreReviewDetails', id: detailId, attributes },
    });
  } else {
    console.log('\nPOST AppStoreReviewDetail ...');
    r = await http('POST', '/v1/appStoreReviewDetails', {
      data: {
        type: 'appStoreReviewDetails', attributes,
        relationships: {
          appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
        },
      },
    });
  }
  console.log(' ', r.status, r.status >= 400 ? r.raw : 'OK');
  if (r.body?.data?.id) {
    IDS.ascReviewDetailId = r.body.data.id;
    fs.writeFileSync(IDS_PATH, JSON.stringify(IDS, null, 2));
  }

  // Build mit Version verlinken
  console.log('\nLink build to version ...');
  const bv = await http('PATCH', `/v1/appStoreVersions/${versionId}/relationships/build`, {
    data: { type: 'builds', id: IDS.ascBuildId },
  });
  console.log(' ', bv.status, bv.status >= 400 ? bv.raw.slice(0, 300) : 'OK');
})().catch(e => { console.error(e); process.exit(1); });
