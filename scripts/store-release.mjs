#!/usr/bin/env node
// Store release for Swing & Savor (iOS + Android together, straight to production).
//
//   node scripts/store-release.mjs status
//   node scripts/store-release.mjs ios-submit <version> <build>
//   node scripts/store-release.mjs play-production <versionCode> <versionName>
//
// Run via roloff-secrets (ASC_*_SWINGSAVOR, REVIEWER_BYPASS_CODE_SWINGSAVOR) and,
// for any write, via roloff-freigabe. The reviewer code is never printed.
//
// ios-submit: creates the App Store version if missing (release after approval),
//   waits until the uploaded build is VALID, sets "What's new" (de-DE, en-US if
//   present), writes the App Review details (demo account + code from the vault,
//   fail-closed), links the build and submits it for review. Re-uses an empty
//   READY_FOR_REVIEW submission (ASC allows only a few open ones).
// play-production: rolls the given versionCode out to 100 % on the production
//   track. The bundle must already be uploaded (android-release.yml puts it on
//   the internal track).
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { SignJWT, importPKCS8 } from 'jose'
import { GoogleAuth } from 'google-auth-library'

const APP_ID = '6770264388'
const PKG = 'de.commsconnect.swingandsavor'
const NOTES = {
  'de-DE': 'Sicherheitsupdate: aktualisierte App-Basis und strengere Schutzmaßnahmen. Dazu kleinere Verbesserungen.',
  'en-US': 'Security update: updated app foundation and stricter protections, plus minor improvements.',
}
const REVIEW_NOTES = (code) => `DEMO ACCOUNT
The reviewer account auto-seeds a pre-populated environment on first login: a private demo cup with players and matches (finished and active), comments and reactions, 3 accepted friendships with demo users and 2 DM conversations with messages from both sides, so the safety mechanisms (block + report) can be reviewed.

LOGIN STEPS
1. Open the app, tap "Anmelden".
2. Enter email: apple-review@swingandsavor.at
3. Tap "Code senden".
4. Enter the 8-digit code: ${code}
5. Home, Cup, Matches, Messages and Profile show content immediately.`

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (m) => { throw new Error(m) }

// ── App Store Connect ───────────────────────────────────────────────────────
async function ascClient() {
  const { ASC_KEY_ID_SWINGSAVOR: kid, ASC_ISSUER_ID_SWINGSAVOR: iss, ASC_API_KEY_PATH_SWINGSAVOR: p } = process.env
  if (!kid || !iss || !p) fail('ASC_*_SWINGSAVOR missing')
  const key = await importPKCS8(readFileSync(p.replace(/^~/, homedir()), 'utf8'), 'ES256')
  let token = null, until = 0
  return async function api(path, init = {}) {
    if (Date.now() > until) {
      token = await new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid, typ: 'JWT' })
        .setIssuer(iss).setAudience('appstoreconnect-v1').setIssuedAt().setExpirationTime('15m').sign(key)
      until = Date.now() + 10 * 60 * 1000
    }
    const res = await fetch('https://api.appstoreconnect.apple.com' + path, {
      ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    })
    const txt = await res.text()
    // Error bodies never contain the review code (it is only sent, not echoed),
    // but keep them short.
    if (!res.ok) fail(`${init.method || 'GET'} ${path} -> ${res.status} ${txt.slice(0, 400)}`)
    return txt ? JSON.parse(txt) : null
  }
}

async function iosStatus(api) {
  const v = await api(`/v1/apps/${APP_ID}/appStoreVersions?limit=5&fields[appStoreVersions]=versionString,appStoreState,releaseType`)
  log('iOS versions:', v.data.map((x) => `${x.attributes.versionString} ${x.attributes.appStoreState}`).join(' | '))
  const s = await api(`/v1/apps/${APP_ID}/reviewSubmissions?limit=10`)
  log('iOS submissions:', s.data.map((x) => x.attributes.state).join(', '))
}

async function iosSubmit(api, version, build) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || !/^\d+$/.test(build)) fail('usage: ios-submit <x.y.z> <build>')
  const code = process.env.REVIEWER_BYPASS_CODE_SWINGSAVOR || ''
  if (!/^\d{8}$/.test(code)) fail('REVIEWER_BYPASS_CODE_SWINGSAVOR missing or not 8 digits (fail closed)')

  // 1 version
  const vs = await api(`/v1/apps/${APP_ID}/appStoreVersions?filter[versionString]=${version}&filter[platform]=IOS`)
  let ver = vs.data[0]
  if (!ver) {
    ver = (await api('/v1/appStoreVersions', { method: 'POST', body: JSON.stringify({ data: {
      type: 'appStoreVersions', attributes: { platform: 'IOS', versionString: version, releaseType: 'AFTER_APPROVAL' },
      relationships: { app: { data: { type: 'apps', id: APP_ID } } } } }) })).data
    log('created version', version)
  }
  const state = ver.attributes.appStoreState
  log('version', version, state)
  if (['WAITING_FOR_REVIEW', 'IN_REVIEW', 'PENDING_DEVELOPER_RELEASE', 'READY_FOR_SALE', 'PROCESSING_FOR_APP_STORE'].includes(state)) {
    log('already submitted / live, nothing to do'); return
  }
  if (ver.attributes.releaseType !== 'AFTER_APPROVAL') {
    await api(`/v1/appStoreVersions/${ver.id}`, { method: 'PATCH', body: JSON.stringify({ data: { type: 'appStoreVersions', id: ver.id, attributes: { releaseType: 'AFTER_APPROVAL' } } }) })
    log('releaseType -> AFTER_APPROVAL')
  }

  // 2 build VALID
  let b = null
  for (let i = 0; i < 120; i++) {
    const r = await api(`/v1/builds?filter[app]=${APP_ID}&filter[version]=${build}&filter[preReleaseVersion.version]=${version}&limit=1`)
    b = r.data[0]
    const st = b?.attributes?.processingState
    if (st === 'VALID') break
    if (st === 'INVALID' || st === 'FAILED') fail(`build ${version} (${build}) ${st}`)
    if (i % 4 === 0) log(`waiting for build ${version} (${build}): ${st || 'not yet visible'}`)
    await sleep(30_000)
  }
  if (b?.attributes?.processingState !== 'VALID') fail('build did not become VALID in time')
  log('build VALID', b.id)

  // 3 what's new
  const locs = await api(`/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`)
  for (const l of locs.data) {
    const text = NOTES[l.attributes.locale]
    if (!text) continue
    await api(`/v1/appStoreVersionLocalizations/${l.id}`, { method: 'PATCH', body: JSON.stringify({ data: { type: 'appStoreVersionLocalizations', id: l.id, attributes: { whatsNew: text } } }) })
    log('whatsNew set', l.attributes.locale)
  }

  // 4 review details (code from vault, never logged)
  const attrs = {
    contactFirstName: 'Rainer', contactLastName: 'Roloff', contactPhone: '+498945221556',
    contactEmail: 'rainer.roloff@comms-connect.de', demoAccountRequired: true,
    demoAccountName: 'apple-review@swingandsavor.at', demoAccountPassword: code, notes: REVIEW_NOTES(code),
  }
  let rd = null
  try { rd = (await api(`/v1/appStoreVersions/${ver.id}/appStoreReviewDetail`)).data } catch { rd = null }
  if (rd) await api(`/v1/appStoreReviewDetails/${rd.id}`, { method: 'PATCH', body: JSON.stringify({ data: { type: 'appStoreReviewDetails', id: rd.id, attributes: attrs } }) })
  else await api('/v1/appStoreReviewDetails', { method: 'POST', body: JSON.stringify({ data: { type: 'appStoreReviewDetails', attributes: attrs, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } } }) })
  log('review details set (demo account + current code)')

  // 5 link build
  await api(`/v1/appStoreVersions/${ver.id}/relationships/build`, { method: 'PATCH', body: JSON.stringify({ data: { type: 'builds', id: b.id } }) })
  log('build linked')

  // 6 submission: re-use an empty READY_FOR_REVIEW one, else create
  const subs = await api(`/v1/apps/${APP_ID}/reviewSubmissions?filter[platform]=IOS&limit=20`)
  if (subs.data.some((s) => ['WAITING_FOR_REVIEW', 'IN_REVIEW', 'UNRESOLVED_ISSUES'].includes(s.attributes.state))) fail('another submission is in review')
  let sub = null
  for (const s of subs.data.filter((x) => x.attributes.state === 'READY_FOR_REVIEW')) {
    const items = await api(`/v1/reviewSubmissions/${s.id}/items`)
    if (items.data.length === 0) { sub = s; break }
  }
  if (!sub) {
    sub = (await api('/v1/reviewSubmissions', { method: 'POST', body: JSON.stringify({ data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: APP_ID } } } } }) })).data
    log('created submission', sub.id)
  } else log('re-using empty submission', sub.id)
  await api('/v1/reviewSubmissionItems', { method: 'POST', body: JSON.stringify({ data: { type: 'reviewSubmissionItems', relationships: {
    reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } }, appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } } }) })
  await api(`/v1/reviewSubmissions/${sub.id}`, { method: 'PATCH', body: JSON.stringify({ data: { type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } } }) })

  // 7 verify
  for (let i = 0; i < 10; i++) {
    const v = (await api(`/v1/appStoreVersions/${ver.id}`)).data
    log('version state', v.attributes.appStoreState)
    if (['WAITING_FOR_REVIEW', 'IN_REVIEW'].includes(v.attributes.appStoreState)) { log('IOS SUBMITTED'); return }
    await sleep(15_000)
  }
  fail('version did not reach WAITING_FOR_REVIEW')
}

// ── Google Play ─────────────────────────────────────────────────────────────
async function playClient() {
  const sa = JSON.parse(execFileSync(`${homedir()}/.local/bin/roloff-tresor`, ['attachment', 'play-service-account-commsos.json'], { stdio: ['ignore', 'pipe', 'inherit'] }))
  const c = await new GoogleAuth({ credentials: sa, scopes: ['https://www.googleapis.com/auth/androidpublisher'] }).getClient()
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`
  return async (method, path, data) => {
    const r = await c.request({ url: base + path, method, data, validateStatus: () => true })
    if (r.status >= 300) fail(`${method} ${path} -> ${r.status} ${JSON.stringify(r.data).slice(0, 400)}`)
    return r.data
  }
}

async function playStatus(play) {
  const e = await play('POST', '/edits')
  const t = await play('GET', `/edits/${e.id}/tracks`)
  for (const tr of t.tracks || []) log('Play', tr.track, JSON.stringify((tr.releases || []).map((r) => ({ n: r.name, s: r.status, vc: r.versionCodes }))))
  await play('DELETE', `/edits/${e.id}`)
}

async function playProduction(play, vc, name) {
  if (!/^\d+$/.test(vc) || !/^\d+\.\d+\.\d+$/.test(name)) fail('usage: play-production <versionCode> <x.y.z>')
  const e = await play('POST', '/edits')
  try {
    const bundles = await play('GET', `/edits/${e.id}/bundles`)
    if (!(bundles.bundles || []).some((b) => String(b.versionCode) === vc)) fail(`versionCode ${vc} not uploaded`)
    const prod = await play('GET', `/edits/${e.id}/tracks/production`)
    if ((prod.releases || []).some((r) => (r.versionCodes || []).includes(vc) && r.status === 'completed')) {
      log('already on production'); await play('DELETE', `/edits/${e.id}`); return
    }
    await play('PUT', `/edits/${e.id}/tracks/production`, { track: 'production', releases: [{
      name: `${name} (${vc})`, versionCodes: [vc], status: 'completed',
      releaseNotes: Object.entries(NOTES).map(([language, text]) => ({ language, text })),
    }] })
    await play('POST', `/edits/${e.id}:commit`)
    log('committed production release', name, vc)
  } catch (err) {
    await play('DELETE', `/edits/${e.id}`).catch(() => {})
    throw err
  }
  const e2 = await play('POST', '/edits')
  const p = await play('GET', `/edits/${e2.id}/tracks/production`)
  await play('DELETE', `/edits/${e2.id}`)
  const ok = (p.releases || []).some((r) => (r.versionCodes || []).includes(vc) && r.status === 'completed')
  log('production track:', JSON.stringify((p.releases || []).map((r) => ({ n: r.name, s: r.status, vc: r.versionCodes }))))
  if (!ok) fail('production release not visible')
  log('PLAY PRODUCTION OK')
}

const [cmd, a, b] = process.argv.slice(2)
try {
  if (cmd === 'status') { await iosStatus(await ascClient()); await playStatus(await playClient()) }
  else if (cmd === 'ios-submit') await iosSubmit(await ascClient(), a, b)
  else if (cmd === 'play-production') await playProduction(await playClient(), a, b)
  else fail('usage: status | ios-submit <version> <build> | play-production <versionCode> <versionName>')
} catch (e) {
  console.error('ERROR', e.message)
  process.exit(1)
}
