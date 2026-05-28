#!/usr/bin/env node
// One-Shot: lädt ein signiertes AAB in den Internal Track der SS-App
// und committed das Release. Idempotent NUR im Sinne von "neue Edits sind billig".

import { readFileSync, statSync } from 'node:fs'
import { GoogleAuth } from 'google-auth-library'

const PKG = 'de.commsconnect.swingandsavor'
const SA  = '/Volumes/Code/Projects/commsos/.local-secrets/play-service-account-commsos.json'
const AAB = process.argv[2] || '/Users/rainer/Downloads/play-console-fixes/swingsavor-1.0-build1.aab'
const TRACK = 'internal'
const RELEASE_NAME = '1.0 (1)'
const RELEASE_NOTES_DE = 'Erste Version.'

const stat = statSync(AAB)
console.log(`AAB: ${AAB} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`)

const auth = new GoogleAuth({
  keyFile: SA,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
})
const client = await auth.getClient()
const HOST = 'https://androidpublisher.googleapis.com'

async function call(method, path, body, headers = {}) {
  const url = `${HOST}${path}`
  const res = await client.request({
    url, method, data: body, headers, validateStatus: () => true,
  })
  return { status: res.status, body: res.data }
}

// 1. Edit anlegen
console.log('\n[1/5] Edit anlegen...')
const edit = await call('POST', `/androidpublisher/v3/applications/${PKG}/edits`)
if (edit.status !== 200) {
  console.error(`Edit-Create fehlgeschlagen: HTTP ${edit.status}`, JSON.stringify(edit.body).slice(0, 400))
  process.exit(1)
}
const editId = edit.body.id
console.log(`    Edit-ID: ${editId}`)

// 2. AAB hochladen (multipart binary)
console.log('\n[2/5] AAB hochladen...')
const aabBytes = readFileSync(AAB)
const uploadRes = await client.request({
  url: `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PKG}/edits/${editId}/bundles?uploadType=media`,
  method: 'POST',
  headers: { 'Content-Type': 'application/octet-stream' },
  data: aabBytes,
  validateStatus: () => true,
})
if (uploadRes.status !== 200) {
  console.error(`AAB-Upload fehlgeschlagen: HTTP ${uploadRes.status}`, JSON.stringify(uploadRes.data).slice(0, 400))
  process.exit(1)
}
const versionCode = uploadRes.data.versionCode
const sha1 = uploadRes.data.sha1
console.log(`    versionCode: ${versionCode}  sha1: ${sha1}`)

// 3. Track-Release setzen
console.log('\n[3/5] Internal-Track Release konfigurieren...')
const trackUpdate = await call(
  'PUT',
  `/androidpublisher/v3/applications/${PKG}/edits/${editId}/tracks/${TRACK}`,
  {
    track: TRACK,
    releases: [{
      name: RELEASE_NAME,
      status: 'completed',
      versionCodes: [String(versionCode)],
      releaseNotes: [{ language: 'de-DE', text: RELEASE_NOTES_DE }],
    }],
  },
)
if (trackUpdate.status !== 200) {
  console.error(`Track-Update fehlgeschlagen: HTTP ${trackUpdate.status}`, JSON.stringify(trackUpdate.body).slice(0, 600))
  process.exit(1)
}
console.log(`    Internal-Track: ${trackUpdate.body.releases?.length} Release(s)`)

// 4. Edit committen (validate ist optional, brauchen wir nicht)
console.log('\n[4/4] Edit committen (live in Play Console)...')
const commit = await call('POST', `/androidpublisher/v3/applications/${PKG}/edits/${editId}:commit?changesNotSentForReview=false`)
if (commit.status !== 200) {
  console.error(`Commit fehlgeschlagen: HTTP ${commit.status}`, JSON.stringify(commit.body).slice(0, 800))
  process.exit(1)
}
console.log(`    Done. Edit ${editId} committed.`)
console.log(`\n✓ ${RELEASE_NAME} (versionCode ${versionCode}) ist im Internal Track von ${PKG}.`)
