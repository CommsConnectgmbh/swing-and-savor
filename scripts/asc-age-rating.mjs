#!/usr/bin/env node
// Liest und korrigiert das Age-Rating auf 4+.
// Apple's ageRatingDeclaration sitzt am App-Info, nicht an der Version.

import { readFileSync } from 'node:fs'
import { SignJWT, importPKCS8 } from 'jose'

const ENV = parseEnv('/Volumes/Code/ClaudeCode/.env.shared')
const KEY_ID    = ENV.ASC_KEY_ID_SWINGSAVOR
const ISSUER_ID = ENV.ASC_ISSUER_ID_SWINGSAVOR
const KEY_PATH  = ENV.ASC_API_KEY_PATH_SWINGSAVOR
const APP_ID    = '6770264388'

function parseEnv(path) {
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

let TOKEN = null
async function jwt() {
  if (TOKEN) return TOKEN
  const pkcs8 = readFileSync(KEY_PATH, 'utf8')
  const key   = await importPKCS8(pkcs8, 'ES256')
  TOKEN = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })
    .setIssuer(ISSUER_ID).setAudience('appstoreconnect-v1')
    .setIssuedAt().setExpirationTime('15m').sign(key)
  return TOKEN
}
async function api(path, init = {}) {
  const t = await jwt()
  const url = path.startsWith('http') ? path : `https://api.appstoreconnect.apple.com${path}`
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  const text = await res.text()
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

const SAFE = {
  alcoholTobaccoOrDrugUseOrReferences: 'NONE',
  contests:                            'NONE',
  gamblingSimulated:                   'NONE',
  medicalOrTreatmentInformation:       'NONE',
  profanityOrCrudeHumor:               'NONE',
  sexualContentGraphicAndNudity:       'NONE',
  sexualContentOrNudity:               'NONE',
  horrorOrFearThemes:                  'NONE',
  matureOrSuggestiveThemes:            'NONE',
  unrestrictedWebAccess:               false,
  gambling:                            false,
  violenceCartoonOrFantasy:            'NONE',
  violenceRealistic:                   'NONE',
  violenceRealisticProlongedGraphicOrSadistic: 'NONE',
  ageRatingOverride:                   'NONE',
  kidsAgeBand:                         null,
}

const apps = await api(`/v1/apps/${APP_ID}/appInfos?include=ageRatingDeclaration`)
const infos = apps.data
const decls = (apps.included || []).filter(x => x.type === 'ageRatingDeclarations')
console.log(`App-Infos: ${infos.length}, AgeRatingDeclarations: ${decls.length}`)

let changed = 0
for (const decl of decls) {
  const before = JSON.stringify(decl.attributes, null, 2)
  try {
    await api(`/v1/ageRatingDeclarations/${decl.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ data: { type: 'ageRatingDeclarations', id: decl.id, attributes: SAFE } }),
    })
    console.log(`✓ AgeRatingDeclaration ${decl.id} → all-NONE gepatcht`)
    changed++
  } catch (e) {
    console.log(`⚠ ${decl.id}:`, e.message)
  }
}

// Nochmal lesen
const after = await api(`/v1/apps/${APP_ID}/appInfos`)
for (const info of after.data) {
  console.log(`AppInfo ${info.id} → ageRating ${info.attributes.appStoreAgeRating}`)
}
console.log(`changed: ${changed}`)
