#!/usr/bin/env node
// Swing & Savor — iOS Submission via App Store Connect API
//
// Was das Script kann:
//  - Eingeloggter Zustand der App lesen (App-Info, neueste Version, Build)
//  - Description / Keywords / Promotional Text / Support-URL / Marketing-URL setzen (DE Locale)
//  - Reviewer-Info (E-Mail + Code) in App Review Detail schreiben
//  - Build aus TestFlight auf die Version verlinken
//  - Status-Report drucken — was noch manuell nötig ist (Screenshots, App Privacy „Publish"-Klick)
//
// Aufruf:   node scripts/asc-submission.mjs [--dry] [--submit]
// Optionen: --dry      nur lesen + planen, nichts schreiben
//           --submit   am Ende ein ReviewSubmission anlegen + den Build anhängen
//
// Voraussetzungen in .env.shared:
//   ASC_KEY_ID_SWINGSAVOR, ASC_ISSUER_ID_SWINGSAVOR, ASC_API_KEY_PATH_SWINGSAVOR

import { readFileSync } from 'node:fs'
import { SignJWT, importPKCS8 } from 'jose'

const ENV = parseEnv('/Volumes/Code/ClaudeCode/.env.shared')
const KEY_ID    = ENV.ASC_KEY_ID_SWINGSAVOR
const ISSUER_ID = ENV.ASC_ISSUER_ID_SWINGSAVOR
const KEY_PATH  = ENV.ASC_API_KEY_PATH_SWINGSAVOR
const APP_ID    = '6770264388' // Swing & Savor in ASC
const LOCALE    = 'de-DE'
const APP_BUNDLE = 'de.commsconnect.swingandsavor'

const args   = new Set(process.argv.slice(2))
const DRY    = args.has('--dry')
const SUBMIT = args.has('--submit')

const META = {
  description: `Swing & Savor ist die Golf-App für Freundes-Cups: Match Play oder Stableford spielen, Flights bis 4-gegen-4 mit fairen Faktoren bei ungleicher Spielerzahl, Live-Scoring Loch für Loch.

• Home-Feed: Was deine Freunde gerade spielen, live mit Score, Foto und Cup-Kontext.
• Duelle: 1-gegen-1 herausfordern, ELO sammelst du automatisch.
• Rangliste: Welt oder nur Freunde — sieh wie du dich schlägst.
• Nachrichten: 1:1-DMs unter Freunden, in Echtzeit.
• Tour-Tab: PGA, DP World, LPGA, Majors — Highlights und Live-Scores als Bridge.

Alles im einheitlichen Design, ohne Werbung, ohne Tracking jenseits dessen, was für die App-Funktion nötig ist.`,
  keywords: 'Golf,Match Play,Stableford,Scorecard,Turnier,Cup,Handicap,Flight,Live,Leaderboard',
  promotionalText: 'Cups mit Freunden, Live-Scoring auf jedem Loch, Flight-Matches mit Faktoren, DMs und globale Rangliste. Schnell, intuitiv, ohne Schnickschnack.',
  supportUrl:   'https://swingandsavor.at/impressum',
  marketingUrl: 'https://swingandsavor.at',
  whatsNew:     'Erste Version. Cups · Match Play · Stableford · Flights mit Faktoren · Live-Scoring · Social-Feed · Rangliste.',
  reviewer: {
    firstName:    'Apple',
    lastName:     'Reviewer',
    phoneNumber:  '+498945221556',
    emailAddress: 'rainer.roloff@comms-connect.de',
    demoAccountRequired: true,
    demoAccountName:     'apple-review@swingandsavor.at',
    demoAccountPassword: '87654321',
    notes: `Reviewer-Bypass aktiv: gib auf dem Login-Screen die E-Mail apple-review@swingandsavor.at ein, dann den 8-stelligen Code 87654321 als OTP. Die Edge Function "reviewer-bypass" akzeptiert nur diese Kombination und gibt eine echte Session aus. Danach Home-Feed, Matches, Cup anlegen, Friends, Messaging und Rangliste vollständig zugänglich.`,
  },
}

const HOST = 'https://api.appstoreconnect.apple.com'
let TOKEN = null

async function jwt() {
  if (TOKEN) return TOKEN
  const pkcs8 = readFileSync(KEY_PATH, 'utf8')
  const key   = await importPKCS8(pkcs8, 'ES256')
  TOKEN = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })
    .setIssuer(ISSUER_ID)
    .setAudience('appstoreconnect-v1')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(key)
  return TOKEN
}

async function api(path, init = {}) {
  const t = await jwt()
  const url = path.startsWith('http') ? path : `${HOST}${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`ASC ${init.method || 'GET'} ${path} → HTTP ${res.status}: ${text}`)
  }
  return text ? JSON.parse(text) : null
}

function parseEnv(path) {
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

function log(...a)   { console.log('•', ...a) }
function warn(...a)  { console.log('⚠', ...a) }
function ok(...a)    { console.log('✓', ...a) }
function step(name)  { console.log(`\n── ${name} ──`) }

// ─────────────────────────────────────────────────────────────────────────
//  Main
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  if (!KEY_ID || !ISSUER_ID || !KEY_PATH) {
    throw new Error('ASC env vars fehlen')
  }
  log('Mode:', DRY ? 'DRY' : SUBMIT ? 'SUBMIT' : 'APPLY')
  log('App-ID:', APP_ID, 'Locale:', LOCALE)

  step('App lesen')
  const app = await api(`/v1/apps/${APP_ID}`)
  ok(`App: ${app.data.attributes.name} · sku ${app.data.attributes.sku} · bundle ${app.data.attributes.bundleId}`)

  step('Aktuelle App-Store-Version finden')
  const versions = await api(`/v1/apps/${APP_ID}/appStoreVersions?limit=10`)
  const editable = versions.data.find(v =>
    ['PREPARE_FOR_SUBMISSION','METADATA_REJECTED','DEVELOPER_REJECTED','REJECTED','INVALID_BINARY'].includes(v.attributes.appStoreState)
  ) || versions.data[0]
  if (!editable) { warn('Keine bearbeitbare Version gefunden'); return }
  ok(`Version: ${editable.attributes.versionString} (${editable.attributes.appStoreState})`)
  const versionId = editable.id

  step('Version-Localization (de-DE) finden / anlegen')
  const locs = await api(`/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`)
  let deLoc = locs.data.find(l => l.attributes.locale === LOCALE)
  if (!deLoc) {
    if (DRY) { log(`würde anlegen: ${LOCALE}`) }
    else {
      const created = await api('/v1/appStoreVersionLocalizations', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'appStoreVersionLocalizations',
            attributes: { locale: LOCALE },
            relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } } },
          }
        }),
      })
      deLoc = created.data
      ok(`Localization ${LOCALE} angelegt: ${deLoc.id}`)
    }
  } else {
    ok(`Localization ${LOCALE} existiert: ${deLoc.id}`)
  }

  if (deLoc) {
    step('Localization patchen (state-aware)')
    const state = editable.attributes.appStoreState
    // promotionalText ist in jedem State editierbar.
    // supportUrl/marketingUrl sind in IN_REVIEW + PROCESSING_FOR_APP_STORE + PENDING_APPLE_RELEASE
    // gesperrt (HTTP 409 STATE_ERROR), in WAITING_FOR_REVIEW noch erlaubt.
    const hardLocked = ['IN_REVIEW','PROCESSING_FOR_APP_STORE','PENDING_APPLE_RELEASE','READY_FOR_DISTRIBUTION'].includes(state)
    const softLocked = ['WAITING_FOR_REVIEW'].includes(state)
    const attrs = hardLocked
      ? { promotionalText: META.promotionalText }
      : softLocked
        ? { promotionalText: META.promotionalText, supportUrl: META.supportUrl, marketingUrl: META.marketingUrl }
        : { description: META.description, keywords: META.keywords, promotionalText: META.promotionalText, supportUrl: META.supportUrl, marketingUrl: META.marketingUrl, whatsNew: META.whatsNew }
    if (hardLocked) warn(`State ist ${state} — nur promotionalText ist editierbar`)
    else if (softLocked) warn(`State ist ${state} — nur promotionalText/supportUrl/marketingUrl sind editierbar`)
    if (DRY) {
      log('würde patchen:', attrs)
    } else {
      await api(`/v1/appStoreVersionLocalizations/${deLoc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: { type: 'appStoreVersionLocalizations', id: deLoc.id, attributes: attrs },
        }),
      })
      ok('Localization gepatcht')
    }
  }

  step('App Review Detail (Reviewer-Credentials)')
  const reviewDetail = await api(`/v1/appStoreVersions/${versionId}/appStoreReviewDetail`).catch(() => null)
  const detailAttrs = {
    contactFirstName:    META.reviewer.firstName,
    contactLastName:     META.reviewer.lastName,
    contactPhone:        META.reviewer.phoneNumber,
    contactEmail:        META.reviewer.emailAddress,
    demoAccountName:     META.reviewer.demoAccountName,
    demoAccountPassword: META.reviewer.demoAccountPassword,
    demoAccountRequired: META.reviewer.demoAccountRequired,
    notes:               META.reviewer.notes,
  }
  if (reviewDetail?.data) {
    if (DRY) log('würde PATCHen review detail', reviewDetail.data.id)
    else {
      await api(`/v1/appStoreReviewDetails/${reviewDetail.data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: { type: 'appStoreReviewDetails', id: reviewDetail.data.id, attributes: detailAttrs },
        }),
      })
      ok('Review-Detail aktualisiert')
    }
  } else {
    if (DRY) log('würde anlegen: review detail')
    else {
      await api('/v1/appStoreReviewDetails', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'appStoreReviewDetails',
            attributes: detailAttrs,
            relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } } },
          },
        }),
      })
      ok('Review-Detail angelegt')
    }
  }

  step('Build aus TestFlight verlinken')
  const state = editable.attributes.appStoreState
  const stateLocksBuild = ['WAITING_FOR_REVIEW','IN_REVIEW','PROCESSING_FOR_APP_STORE','READY_FOR_DISTRIBUTION','PENDING_APPLE_RELEASE'].includes(state)
  if (stateLocksBuild) {
    const current = await api(`/v1/appStoreVersions/${versionId}/build`).catch(() => null)
    if (current?.data) ok(`Build bereits verlinkt: ${current.data.id} (State ${state} — keine Änderung möglich)`)
    else warn(`State ${state}, aber kein Build verlinkt — manueller Eingriff nötig`)
  } else {
    const builds = await api(`/v1/builds?filter[app]=${APP_ID}&filter[processingState]=VALID&sort=-uploadedDate&limit=5`)
    const candidate = builds.data?.[0]
    if (!candidate) {
      warn('Kein valider TestFlight-Build gefunden — überspringe Verlinkung')
    } else {
      ok(`Build: ${candidate.attributes.version}(${candidate.attributes.buildAudienceType || ''}) · uploaded ${candidate.attributes.uploadedDate}`)
      if (DRY) log('würde verlinken via PATCH appStoreVersions.build')
      else {
        await api(`/v1/appStoreVersions/${versionId}/relationships/build`, {
          method: 'PATCH',
          body: JSON.stringify({ data: { type: 'builds', id: candidate.id } }),
        })
        ok('Build verlinkt')
      }
    }
  }

  step('Status: Screenshots')
  const apptInfos = await api(`/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`)
  let screenshotCount = 0
  for (const l of apptInfos.data) {
    const sets = await api(`/v1/appStoreVersionLocalizations/${l.id}/appScreenshotSets`)
    for (const s of sets.data) {
      const shots = await api(`/v1/appScreenshotSets/${s.id}/appScreenshots`)
      screenshotCount += shots.data.length
    }
  }
  if (screenshotCount === 0) warn(`Noch 0 Screenshots — Apple lehnt Submission ohne ab. Manueller Upload nötig (siehe iOS_SUBMISSION_CHECKLIST.md).`)
  else ok(`${screenshotCount} Screenshots gefunden`)

  step('Status: App-Privacy')
  // App Privacy lives on the App, not on the version.
  const privacy = await api(`/v1/apps/${APP_ID}/appInfos`)
  const primary = privacy.data?.[0]
  if (primary?.attributes?.appStoreAgeRating) ok(`Age Rating: ${primary.attributes.appStoreAgeRating}`)
  warn('App Privacy "Publish"-Klick (oben rechts in ASC) ist UI-only — bitte einmal manuell.')

  if (SUBMIT) {
    step('Submission anlegen (ReviewSubmission + Item)')
    // Wenn schon eine offene Submission existiert, neue verboten — erst prüfen.
    const existing = await api(`/v1/apps/${APP_ID}/reviewSubmissions?filter[state]=IN_PROGRESS,READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW`).catch(() => ({ data: [] }))
    if (existing.data?.length > 0) {
      warn(`Bestehende Submission im Status ${existing.data[0].attributes.state} — überspringe.`)
    } else {
      const sub = await api('/v1/reviewSubmissions', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'reviewSubmissions',
            attributes: { platform: 'IOS' },
            relationships: { app: { data: { type: 'apps', id: APP_ID } } },
          },
        }),
      })
      ok(`ReviewSubmission ${sub.data.id} angelegt`)

      await api('/v1/reviewSubmissionItems', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'reviewSubmissionItems',
            relationships: {
              reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.data.id } },
              appStoreVersion:  { data: { type: 'appStoreVersions',  id: versionId } },
            },
          },
        }),
      })
      ok('Version an Submission gehängt')

      await api(`/v1/reviewSubmissions/${sub.data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: {
            type: 'reviewSubmissions',
            id: sub.data.id,
            attributes: { submitted: true },
          },
        }),
      })
      ok('Submission auf SUBMITTED gesetzt')
    }
  }

  console.log('\nFertig.')
}

main().catch((e) => {
  console.error('\n❌', e.message)
  process.exit(1)
})
