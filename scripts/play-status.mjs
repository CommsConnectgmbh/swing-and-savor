#!/usr/bin/env node
// Prüft ob es ein Google-Play-App-Record für de.commsconnect.swingandsavor gibt.
// Falls ja → Edit anlegen + Tracks listen. Falls 404 → klar dokumentieren dass
// der initiale „Create app"-Klick in der Play Console UI-Pflicht ist.

import { readFileSync } from 'node:fs'
import { GoogleAuth } from 'google-auth-library'

const PKG = 'de.commsconnect.swingandsavor'
const SA  = '/Volumes/Code/Projects/commsos/.local-secrets/play-service-account-commsos.json'

const auth = new GoogleAuth({
  keyFile: SA,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
})

const client = await auth.getClient()
const HOST = 'https://androidpublisher.googleapis.com'

async function call(method, path, body) {
  const url = `${HOST}${path}`
  const res = await client.request({ url, method, data: body, validateStatus: () => true })
  return { status: res.status, body: res.data }
}

console.log(`Check App-Record für: ${PKG}`)
const edit = await call('POST', `/androidpublisher/v3/applications/${PKG}/edits`)
if (edit.status === 200) {
  console.log(`✓ App existiert in Play Console. Edit-ID: ${edit.body.id}`)
  const tracks = await call('GET', `/androidpublisher/v3/applications/${PKG}/edits/${edit.body.id}/tracks`)
  console.log(`Tracks:`, tracks.body.tracks?.map(t => `${t.track}(${t.releases?.length || 0})`).join(', ') || 'keine')
  // Edit wieder verwerfen, sonst stört's manuelle Edits
  await call('DELETE', `/androidpublisher/v3/applications/${PKG}/edits/${edit.body.id}`)
} else if (edit.status === 404) {
  console.log(`✗ Kein App-Record gefunden (HTTP 404).`)
  console.log()
  console.log(`Google blockt "Create App" über API — ist Pflicht-UI-Schritt.`)
  console.log(`Was Rainer 5 Minuten in der Play Console klicken muss:`)
  console.log(`  1. https://play.google.com/console → "App erstellen"`)
  console.log(`  2. App-Name: Swing & Savor`)
  console.log(`  3. Default-Sprache: Deutsch (Deutschland)`)
  console.log(`  4. App oder Spiel: App`)
  console.log(`  5. Kostenlos oder kostenpflichtig: Kostenlos`)
  console.log(`  6. Deklarationen: Inhaltsrichtlinien + US-Exportgesetze haken`)
  console.log(`  7. Dann unter "App-Inhalte" Datenschutzerklärungs-URL: https://swingandsavor.at/datenschutz`)
  console.log(`  8. Service-Account für API-Upload freischalten:`)
  console.log(`     Setup → API-Zugriff → "commsos-play-publisher@comms-play-publisher.iam.gserviceaccount.com" → App-Berechtigungen → SS hinzufügen`)
  console.log(`     → Rollen: App-Informationen + Tests verwalten + Releases zu Test-Tracks`)
  console.log()
  console.log(`Sobald App-Record existiert + SA freigeschaltet ist, übernehme ich:`)
  console.log(`  • AAB aus CI-Build hochladen (Internal Track)`)
  console.log(`  • Store-Listing füllen (Description, Screenshots, etc.)`)
  console.log(`  • Datensicherheit-Form ausfüllen`)
  console.log(`  • Submission an Production-Track`)
} else {
  console.log(`Unerwartet HTTP ${edit.status}:`, JSON.stringify(edit.body).slice(0, 300))
}
