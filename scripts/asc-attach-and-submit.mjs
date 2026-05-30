#!/usr/bin/env node
// Hängt 1.1.4 als Item an die erste leere READY_FOR_REVIEW-Submission und submitted sie.
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

// 1) Hole 1.1.4 Version-ID
const versions = await api(`/v1/apps/${APP_ID}/appStoreVersions?limit=10`)
const v114 = versions.data.find(v => v.attributes.versionString === '1.1.4')
if (!v114) throw new Error('1.1.4 nicht gefunden')
console.log(`✓ Version 1.1.4: ${v114.id} (${v114.attributes.appStoreState})`)

// 2) Hole READY_FOR_REVIEW-Submissions (leer / submittable)
const subs = await api(`/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&limit=20`)
const ready = (subs.data || []).filter(s => s.attributes.state === 'READY_FOR_REVIEW')
console.log(`• ${ready.length} READY_FOR_REVIEW-Submissions`)

// 3) Pro Submission: Items prüfen — wenn leer, anhängen + submit, sonst nur submit
for (const s of ready) {
  console.log(`\n→ ${s.id}`)
  const items = await api(`/v1/reviewSubmissions/${s.id}/items`)
  const itemCount = items.data?.length || 0
  console.log(`  Items: ${itemCount}`)

  if (itemCount === 0) {
    // Item attachen
    try {
      const item = await api(`/v1/reviewSubmissionItems`, {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'reviewSubmissionItems',
            relationships: {
              reviewSubmission: { data: { type: 'reviewSubmissions', id: s.id } },
              appStoreVersion:  { data: { type: 'appStoreVersions',  id: v114.id } },
            },
          },
        }),
      })
      console.log(`  ✓ Item attached: ${item.data.id}`)
    } catch (e) {
      console.log(`  ✗ Attach failed: ${e.message.slice(0, 200)}`)
      continue
    }
  }

  // Submit
  try {
    await api(`/v1/reviewSubmissions/${s.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: { type: 'reviewSubmissions', id: s.id, attributes: { submitted: true } },
      }),
    })
    console.log(`  ✓ Submitted`)
    break
  } catch (e) {
    console.log(`  ✗ Submit failed: ${e.message.slice(0, 300)}`)
  }
}
