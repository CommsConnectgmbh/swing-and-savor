#!/usr/bin/env node
// Swing & Savor — finalise Oliver's internal TestFlight access.
//
// Run AFTER Oliver accepts the App Store Connect team invitation. It checks
// whether he is now a team user and, if so, adds him to the "Internal Testing"
// beta group so he gets the current build (1.1.4 / build 17) in TestFlight.
// Idempotent — safe to run repeatedly until it succeeds.
//
//   node scripts/asc-finish-internal.mjs [--email <addr>]

import { readFileSync } from 'node:fs'
import { SignJWT, importPKCS8 } from 'jose'

const ENV = Object.fromEntries(
  readFileSync('/Volumes/Code/ClaudeCode/.env.shared', 'utf8')
    .split('\n').map(l => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].trim()]),
)
const KEY_ID = ENV.ASC_KEY_ID_SWINGSAVOR, ISSUER = ENV.ASC_ISSUER_ID_SWINGSAVOR, KEY_PATH = ENV.ASC_API_KEY_PATH_SWINGSAVOR
const INTERNAL_GROUP = '36595275-94ef-41e9-8bc3-33ff52a24a0f'
const i = process.argv.indexOf('--email')
const EMAIL = (i >= 0 ? process.argv[i + 1] : 'oli.hoffmann@outlook.com').toLowerCase()

const key = await importPKCS8(readFileSync(KEY_PATH, 'utf8'), 'ES256')
const jwt = await new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })
  .setIssuer(ISSUER).setAudience('appstoreconnect-v1').setIssuedAt().setExpirationTime('15m').sign(key)
const api = async (p, init = {}) => {
  const r = await fetch('https://api.appstoreconnect.apple.com' + p, { ...init, headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  const b = await r.text()
  if (!r.ok) throw new Error(`${init.method || 'GET'} ${p} → ${r.status} ${b.slice(0, 300)}`)
  return b ? JSON.parse(b) : null
}

const users = await api(`/v1/users?limit=200&fields[users]=username`)
const isUser = users.data.some(u => u.attributes.username.toLowerCase() === EMAIL)
if (!isUser) {
  console.log(`• ${EMAIL} hat die Team-Einladung noch nicht angenommen — später erneut laufen lassen.`)
  process.exit(0)
}

// Already an internal tester?
const ex = await api(`/v1/betaTesters?filter[email]=${encodeURIComponent(EMAIL)}&include=betaGroups&limit=10`)
const inGroup = ex.data.some(t => (t.relationships?.betaGroups?.data || []).some(g => g.id === INTERNAL_GROUP))
if (inGroup) { console.log('✓ Oliver ist bereits in Internal Testing — fertig.'); process.exit(0) }

const created = await api('/v1/betaTesters', {
  method: 'POST',
  body: JSON.stringify({ data: { type: 'betaTesters', attributes: { email: EMAIL, firstName: 'Oliver', lastName: 'Hoffmann' }, relationships: { betaGroups: { data: [{ type: 'betaGroups', id: INTERNAL_GROUP }] } } } }),
})
console.log(`✓ Oliver in Internal Testing aufgenommen (${created.data.id}) — Build 1.1.4 in TestFlight verfügbar.`)
