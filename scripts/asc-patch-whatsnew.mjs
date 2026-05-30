#!/usr/bin/env node
// Setzt das "Was ist neu"-Feld für die nächste editierbare Version, de-DE.
// Use: node scripts/asc-patch-whatsnew.mjs "<text>"
import { readFileSync } from 'node:fs'
import { SignJWT, importPKCS8 } from 'jose'

const TEXT = process.argv[2]
if (!TEXT) { console.error('Usage: asc-patch-whatsnew.mjs <text>'); process.exit(1) }

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

const list = await api(`/v1/apps/${APP_ID}/appStoreVersions?limit=10`)
const editStates = ['PREPARE_FOR_SUBMISSION','DEVELOPER_REJECTED','REJECTED','METADATA_REJECTED']
const v = list.data?.find(x => editStates.includes(x.attributes.appStoreState))
if (!v) { console.error('Keine editierbare Version gefunden'); process.exit(1) }
console.log(`• Version: ${v.attributes.versionString} (${v.attributes.appStoreState})`)

const locs = await api(`/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations`)
const de = locs.data?.find(l => l.attributes.locale === 'de-DE')
if (!de) { console.error('Locale de-DE nicht gefunden'); process.exit(1) }

await api(`/v1/appStoreVersionLocalizations/${de.id}`, {
  method: 'PATCH',
  body: JSON.stringify({
    data: { type: 'appStoreVersionLocalizations', id: de.id, attributes: { whatsNew: TEXT } },
  }),
})
console.log(`✓ whatsNew gesetzt (de-DE)`)
