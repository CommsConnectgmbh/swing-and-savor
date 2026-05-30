#!/usr/bin/env node
// Legt eine neue App-Store-Version an, falls sie noch nicht existiert.
// Use: node scripts/asc-create-version.mjs 1.1.4
import { readFileSync } from 'node:fs'
import { SignJWT, importPKCS8 } from 'jose'

const TARGET = process.argv[2]
if (!TARGET) { console.error('Usage: asc-create-version.mjs <versionString>'); process.exit(1) }

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
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const txt = await res.text()
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${txt}`)
  return txt ? JSON.parse(txt) : null
}

const list = await api(`/v1/apps/${APP_ID}/appStoreVersions?limit=20`)
const existing = list.data?.find(v => v.attributes.versionString === TARGET)
if (existing) {
  console.log(`Version ${TARGET} existiert bereits: ${existing.id} (${existing.attributes.appStoreState})`)
  process.exit(0)
}

const created = await api('/v1/appStoreVersions', {
  method: 'POST',
  body: JSON.stringify({
    data: {
      type: 'appStoreVersions',
      attributes: {
        platform: 'IOS',
        versionString: TARGET,
        releaseType: 'AFTER_APPROVAL',
      },
      relationships: {
        app: { data: { type: 'apps', id: APP_ID } },
      },
    },
  }),
})

console.log(`✓ ${TARGET} angelegt: ${created.data.id} (${created.data.attributes.appStoreState})`)
