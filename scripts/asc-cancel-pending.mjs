#!/usr/bin/env node
// Listet ReviewSubmissions und cancelt alle mit state=READY_FOR_REVIEW.
import { readFileSync } from 'node:fs'
import { SignJWT, importPKCS8 } from 'jose'

const ENV = Object.fromEntries(
  readFileSync('/Volumes/Code/ClaudeCode/.env.shared', 'utf8')
    .split('\n').filter(Boolean).map(l => l.split('=')).filter(p => p.length === 2)
)
const KEY_ID    = ENV.ASC_KEY_ID_SWINGSAVOR
const ISSUER_ID = ENV.ASC_ISSUER_ID_SWINGSAVOR
const KEY_PATH  = ENV.ASC_API_KEY_PATH_SWINGSAVOR
const APP_ID    = '6770264388'

const pkcs8 = readFileSync(KEY_PATH, 'utf8')
const key   = await importPKCS8(pkcs8, 'ES256')
const TOKEN = await new SignJWT({})
  .setProtectedHeader({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })
  .setIssuer(ISSUER_ID).setAudience('appstoreconnect-v1')
  .setIssuedAt().setExpirationTime('20m').sign(key)

async function api(path, init = {}) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    ...init,
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const txt = await res.text()
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${txt}`)
  return txt ? JSON.parse(txt) : null
}

const list = await api(`/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&limit=20`)
const subs = list.data || []
console.log(`• ${subs.length} ReviewSubmissions gefunden`)
for (const s of subs) {
  const state = s.attributes.state
  console.log(`  ${s.id} · state=${state} · submitted=${s.attributes.submittedDate}`)
}
const cancelable = subs.filter(s =>
  ['READY_FOR_REVIEW','WAITING_FOR_REVIEW'].includes(s.attributes.state))
for (const s of cancelable) {
  console.log(`→ cancel ${s.id} (${s.attributes.state})`)
  await api(`/v1/reviewSubmissions/${s.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: { type: 'reviewSubmissions', id: s.id, attributes: { canceled: true } },
    }),
  })
  console.log(`  ✓ canceled`)
}
console.log('Done.')
