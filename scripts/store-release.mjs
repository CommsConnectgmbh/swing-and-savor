#!/usr/bin/env node
// Store release for Swing & Savor (iOS + Android together, straight to production).
//
//   node scripts/store-release.mjs status
//   node scripts/store-release.mjs ios-submit <version> <build>      -> prints IOS SUBMITTED
//   node scripts/store-release.mjs play-check <versionCode>          -> prints PLAY CHECK OK
//   node scripts/store-release.mjs play-production <versionCode> <versionName> -> PLAY PRODUCTION OK
//
// Run via roloff-secrets (ASC_*_SWINGSAVOR, REVIEWER_BYPASS_CODE_SWINGSAVOR) and,
// for any write, via roloff-freigabe. The reviewer code is never printed.
// Logic lives in scripts/lib/storeRelease.mjs (tested in storeRelease.test.js).
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { SignJWT, importPKCS8 } from 'jose'
import { GoogleAuth } from 'google-auth-library'
import { APP_ID, iosSubmit, playCheck, playProduction } from './lib/storeRelease.mjs'

const PKG = 'de.commsconnect.swingandsavor'
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

async function ascClient() {
  const { ASC_KEY_ID_SWINGSAVOR: kid, ASC_ISSUER_ID_SWINGSAVOR: iss, ASC_API_KEY_PATH_SWINGSAVOR: p } = process.env
  if (!kid || !iss || !p) throw new Error('ASC_*_SWINGSAVOR missing')
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
    // Status and error codes only; bodies may echo attributes.
    if (!res.ok) {
      let codes = ''
      try { codes = JSON.parse(txt).errors.map((e) => e.code).join(',') } catch { /* not json */ }
      throw new Error(`${init.method || 'GET'} ${path.split('?')[0]} -> ${res.status} ${codes}`)
    }
    return txt ? JSON.parse(txt) : null
  }
}

async function playClient() {
  const sa = JSON.parse(execFileSync(`${homedir()}/.local/bin/roloff-tresor`, ['attachment', 'play-service-account-commsos.json'], { stdio: ['ignore', 'pipe', 'inherit'] }))
  const c = await new GoogleAuth({ credentials: sa, scopes: ['https://www.googleapis.com/auth/androidpublisher'] }).getClient()
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`
  return async (method, path, data) => {
    const r = await c.request({ url: base + path, method, data, validateStatus: () => true })
    if (r.status >= 300) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`)
    return r.data
  }
}

async function status() {
  const api = await ascClient()
  const v = await api(`/v1/apps/${APP_ID}/appStoreVersions?limit=5&fields[appStoreVersions]=versionString,appStoreState,releaseType`)
  log('iOS versions:', v.data.map((x) => `${x.attributes.versionString} ${x.attributes.appStoreState}`).join(' | '))
  const s = await api(`/v1/apps/${APP_ID}/reviewSubmissions?limit=10`)
  log('iOS submissions:', s.data.map((x) => x.attributes.state).join(', '))
  const play = await playClient()
  const e = await play('POST', '/edits')
  const t = await play('GET', `/edits/${e.id}/tracks`)
  for (const tr of t.tracks || []) log('Play', tr.track, JSON.stringify((tr.releases || []).map((r) => ({ n: r.name, s: r.status, vc: r.versionCodes }))))
  await play('DELETE', `/edits/${e.id}`)
}

const [cmd, a, b] = process.argv.slice(2)
try {
  if (cmd === 'status') await status()
  else if (cmd === 'ios-submit') {
    const r = await iosSubmit(await ascClient(), a, b, process.env.REVIEWER_BYPASS_CODE_SWINGSAVOR, { log })
    log(r === 'already' ? 'IOS SUBMITTED (already)' : 'IOS SUBMITTED')
  } else if (cmd === 'play-check') {
    const r = await playCheck(await playClient(), a)
    log('play-check', JSON.stringify(r))
    if (!r.ok) throw new Error(`versionCode ${a} not uploaded to internal`)
    log('PLAY CHECK OK')
  } else if (cmd === 'play-production') {
    const r = await playProduction(await playClient(), a, b, { log })
    log(r === 'already' ? 'PLAY PRODUCTION OK (already)' : 'PLAY PRODUCTION OK')
  } else throw new Error('usage: status | ios-submit <version> <build> | play-check <vc> | play-production <vc> <name>')
} catch (e) {
  console.error('ERROR', e.message)
  process.exit(1)
}
