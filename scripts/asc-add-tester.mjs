#!/usr/bin/env node
// Swing & Savor — TestFlight external tester management via App Store Connect API
//
// Adds an external TestFlight tester to App 6770264388 and links them to an
// external beta group (Apple sends the invite mail on group assignment).
//
// Aufruf:
//   node scripts/asc-add-tester.mjs --email <addr> [--first <name>] [--last <name>] [--group "<group name>"] [--dry]
//
// Voraussetzungen in /Volumes/Code/ClaudeCode/.env.shared:
//   ASC_KEY_ID_SWINGSAVOR, ASC_ISSUER_ID_SWINGSAVOR, ASC_API_KEY_PATH_SWINGSAVOR

import { readFileSync } from 'node:fs'
import { SignJWT, importPKCS8 } from 'jose'

const ENV       = parseEnv('/Volumes/Code/ClaudeCode/.env.shared')
const KEY_ID    = ENV.ASC_KEY_ID_SWINGSAVOR
const ISSUER_ID = ENV.ASC_ISSUER_ID_SWINGSAVOR
const KEY_PATH  = ENV.ASC_API_KEY_PATH_SWINGSAVOR
const APP_ID    = '6770264388'

const argv = process.argv.slice(2)
function arg(name, def = undefined) {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def
}
const DRY        = argv.includes('--dry')
const EMAIL      = (arg('email') || '').toLowerCase()
const FIRST      = arg('first', 'Tester')
const LAST       = arg('last', '')
const GROUP_NAME = arg('group', 'External Testers')

const HOST = 'https://api.appstoreconnect.apple.com'
let TOKEN = null

async function jwt() {
  if (TOKEN) return TOKEN
  const key = await importPKCS8(readFileSync(KEY_PATH, 'utf8'), 'ES256')
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
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`ASC ${init.method || 'GET'} ${path} → HTTP ${res.status}: ${text}`)
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

const log = (...a) => console.log('•', ...a)
const ok  = (...a) => console.log('✓', ...a)

async function main() {
  if (!KEY_ID || !ISSUER_ID || !KEY_PATH) throw new Error('ASC_*_SWINGSAVOR env vars missing')
  if (!EMAIL) throw new Error('--email <addr> required')

  // 1) Find or create an external beta group for the app.
  const groups = await api(`/v1/apps/${APP_ID}/betaGroups?limit=200`)
  let group = groups.data.find(g => g.attributes.name === GROUP_NAME)
            || groups.data.find(g => !g.attributes.isInternalGroup)
  if (group) {
    log(`Beta-Gruppe: "${group.attributes.name}" (${group.id}, ${group.attributes.isInternalGroup ? 'intern' : 'extern'})`)
  } else {
    log(`Keine externe Beta-Gruppe gefunden → lege "${GROUP_NAME}" an`)
    if (DRY) { log('[dry] würde Gruppe anlegen'); return }
    const created = await api('/v1/betaGroups', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'betaGroups',
          attributes: { name: GROUP_NAME, publicLinkEnabled: false },
          relationships: { app: { data: { type: 'apps', id: APP_ID } } },
        },
      }),
    })
    group = created.data
    ok(`Gruppe angelegt: ${group.id}`)
  }

  // 2) Already a tester on this app?
  const existing = await api(`/v1/betaTesters?filter[email]=${encodeURIComponent(EMAIL)}&filter[apps]=${APP_ID}&include=betaGroups&limit=10`)
  if (existing.data.length) {
    const t = existing.data[0]
    const inGroup = (t.relationships?.betaGroups?.data || []).some(g => g.id === group.id)
    log(`Tester existiert bereits (${t.id})${inGroup ? ', schon in der Gruppe' : ''}`)
    if (inGroup) { ok('Nichts zu tun — Oliver ist bereits eingeladen.'); return }
    if (DRY) { log('[dry] würde bestehenden Tester der Gruppe hinzufügen'); return }
    await api(`/v1/betaGroups/${group.id}/relationships/betaTesters`, {
      method: 'POST',
      body: JSON.stringify({ data: [{ type: 'betaTesters', id: t.id }] }),
    })
    ok(`Bestehenden Tester der Gruppe hinzugefügt → Einladung an ${EMAIL} ausgelöst.`)
    return
  }

  // 3) Create the tester and assign to the group in one call (triggers invite).
  if (DRY) { log(`[dry] würde Tester ${EMAIL} anlegen + Gruppe ${group.id} zuweisen`); return }
  const created = await api('/v1/betaTesters', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'betaTesters',
        attributes: { email: EMAIL, firstName: FIRST, lastName: LAST },
        relationships: { betaGroups: { data: [{ type: 'betaGroups', id: group.id }] } },
      },
    }),
  })
  ok(`Tester angelegt: ${created.data.id} — TestFlight-Einladung an ${EMAIL} ausgelöst.`)
}

main().catch(e => { console.error('✗', e.message); process.exit(1) })
