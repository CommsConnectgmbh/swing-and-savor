// Store release logic for Swing & Savor, independent of transport so it can be
// tested with fakes (scripts/lib/storeRelease.test.js). CLI: scripts/store-release.mjs.
//
// ascApi(path, init) -> parsed JSON or throws; play(method, path, data) -> JSON or throws.

export const APP_ID = '6770264388'
export const NOTES = {
  'de-DE': 'Sicherheitsupdate: aktualisierte App-Basis und strengere Schutzmaßnahmen. Dazu kleinere Verbesserungen.',
  'en-US': 'Security update: updated app foundation and stricter protections, plus minor improvements.',
}
export const REVIEW_NOTES = (code) => `DEMO ACCOUNT
The reviewer account auto-seeds a pre-populated environment on first login: a private demo cup with players and matches (finished and active), comments and reactions, 3 accepted friendships with demo users and 2 DM conversations with messages from both sides, so the safety mechanisms (block + report) can be reviewed.

LOGIN STEPS
1. Open the app, tap "Anmelden".
2. Enter email: apple-review@swingandsavor.at
3. Tap "Code senden".
4. Enter the 8-digit code: ${code}
5. Home, Cup, Matches, Messages and Profile show content immediately.`

const SUBMITTED = ['WAITING_FOR_REVIEW', 'IN_REVIEW']
const fail = (m) => { throw new Error(m) }
const body = (data) => ({ body: JSON.stringify({ data }) })

/** Version state, linked build and release type; success only if all match. */
export async function iosVerify(api, versionId, buildId) {
  const v = (await api(`/v1/appStoreVersions/${versionId}`)).data
  const b = (await api(`/v1/appStoreVersions/${versionId}/build`)).data
  return {
    state: v.attributes.appStoreState,
    releaseType: v.attributes.releaseType,
    buildOk: !!b && b.id === buildId,
    ok: SUBMITTED.includes(v.attributes.appStoreState) && v.attributes.releaseType === 'AFTER_APPROVAL' && !!b && b.id === buildId,
  }
}

export async function iosSubmit(api, version, build, code, { sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {}, buildPolls = 120 } = {}) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || !/^\d+$/.test(build)) fail('usage: ios-submit <x.y.z> <build>')
  if (!/^\d{8}$/.test(code || '')) fail('reviewer code missing or not 8 digits (fail closed)')

  // build first: everything below is bound to exactly this build
  let b = null
  for (let i = 0; i < buildPolls; i++) {
    const r = await api(`/v1/builds?filter[app]=${APP_ID}&filter[version]=${build}&filter[preReleaseVersion.version]=${version}&limit=1`)
    b = r.data[0] || null
    const st = b?.attributes?.processingState
    if (st === 'VALID') break
    if (st === 'INVALID' || st === 'FAILED') fail(`build ${version} (${build}) ${st}`)
    if (i % 4 === 0) log(`waiting for build ${version} (${build}): ${st || 'not yet visible'}`)
    await sleep(30_000)
  }
  if (b?.attributes?.processingState !== 'VALID') fail('build did not become VALID in time')
  log('build VALID')

  const vs = await api(`/v1/apps/${APP_ID}/appStoreVersions?filter[versionString]=${version}&filter[platform]=IOS`)
  let ver = vs.data[0]
  if (ver) {
    const st = ver.attributes.appStoreState
    if (SUBMITTED.includes(st)) {
      const chk = await iosVerify(api, ver.id, b.id)
      if (chk.ok) { log('already submitted with this build and automatic release'); return 'already' }
      fail(`version ${version} already ${st} but not with build ${build} / AFTER_APPROVAL (${JSON.stringify(chk)})`)
    }
    if (!['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED'].includes(st)) fail(`version ${version} in state ${st}`)
  } else {
    ver = (await api('/v1/appStoreVersions', { method: 'POST', ...body({
      type: 'appStoreVersions', attributes: { platform: 'IOS', versionString: version, releaseType: 'AFTER_APPROVAL' },
      relationships: { app: { data: { type: 'apps', id: APP_ID } } } }) })).data
    log('created version')
  }
  if (ver.attributes.releaseType !== 'AFTER_APPROVAL') {
    await api(`/v1/appStoreVersions/${ver.id}`, { method: 'PATCH', ...body({ type: 'appStoreVersions', id: ver.id, attributes: { releaseType: 'AFTER_APPROVAL' } }) })
  }

  const locs = await api(`/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`)
  for (const l of locs.data) {
    const text = NOTES[l.attributes.locale]
    if (text) await api(`/v1/appStoreVersionLocalizations/${l.id}`, { method: 'PATCH', ...body({ type: 'appStoreVersionLocalizations', id: l.id, attributes: { whatsNew: text } }) })
  }

  const attrs = {
    contactFirstName: 'Rainer', contactLastName: 'Roloff', contactPhone: '+498945221556',
    contactEmail: 'rainer.roloff@comms-connect.de', demoAccountRequired: true,
    demoAccountName: 'apple-review@swingandsavor.at', demoAccountPassword: code, notes: REVIEW_NOTES(code),
  }
  let rd = null
  try { rd = (await api(`/v1/appStoreVersions/${ver.id}/appStoreReviewDetail`)).data } catch { rd = null }
  if (rd) await api(`/v1/appStoreReviewDetails/${rd.id}`, { method: 'PATCH', ...body({ type: 'appStoreReviewDetails', id: rd.id, attributes: attrs }) })
  else await api('/v1/appStoreReviewDetails', { method: 'POST', ...body({ type: 'appStoreReviewDetails', attributes: attrs, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } }) })
  log('review details set')

  await api(`/v1/appStoreVersions/${ver.id}/relationships/build`, { method: 'PATCH', ...body({ type: 'builds', id: b.id }) })

  const subs = await api(`/v1/apps/${APP_ID}/reviewSubmissions?filter[platform]=IOS&limit=20`)
  if (subs.data.some((s) => ['WAITING_FOR_REVIEW', 'IN_REVIEW', 'UNRESOLVED_ISSUES'].includes(s.attributes.state))) fail('another submission is in review')
  let sub = null
  for (const s of subs.data.filter((x) => x.attributes.state === 'READY_FOR_REVIEW')) {
    if ((await api(`/v1/reviewSubmissions/${s.id}/items`)).data.length === 0) { sub = s; break }
  }
  if (!sub) sub = (await api('/v1/reviewSubmissions', { method: 'POST', ...body({ type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: APP_ID } } } }) })).data
  await api('/v1/reviewSubmissionItems', { method: 'POST', ...body({ type: 'reviewSubmissionItems', relationships: {
    reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } }, appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } }) })
  await api(`/v1/reviewSubmissions/${sub.id}`, { method: 'PATCH', ...body({ type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } }) })

  for (let i = 0; i < 10; i++) {
    const chk = await iosVerify(api, ver.id, b.id)
    log(`version ${chk.state}, build linked ${chk.buildOk}, release ${chk.releaseType}`)
    if (chk.ok) return 'submitted'
    await sleep(15_000)
  }
  fail('version did not reach review with this build and automatic release')
}

/** versionCode is uploaded and on the internal track (completed). */
export async function playCheck(play, vc) {
  const e = await play('POST', '/edits')
  try {
    const bundles = await play('GET', `/edits/${e.id}/bundles`)
    const uploaded = (bundles.bundles || []).some((b) => String(b.versionCode) === String(vc))
    const internal = await play('GET', `/edits/${e.id}/tracks/internal`)
    const onInternal = (internal.releases || []).some((r) => (r.versionCodes || []).map(String).includes(String(vc)))
    return { uploaded, onInternal, ok: uploaded && onInternal }
  } finally {
    await play('DELETE', `/edits/${e.id}`).catch(() => {})
  }
}

export async function playProduction(play, vc, name, { log = () => {} } = {}) {
  if (!/^\d+$/.test(String(vc)) || !/^\d+\.\d+\.\d+$/.test(name)) fail('usage: play-production <versionCode> <x.y.z>')
  const e = await play('POST', '/edits')
  try {
    const bundles = await play('GET', `/edits/${e.id}/bundles`)
    if (!(bundles.bundles || []).some((b) => String(b.versionCode) === String(vc))) fail(`versionCode ${vc} not uploaded`)
    const prod = await play('GET', `/edits/${e.id}/tracks/production`)
    if ((prod.releases || []).some((r) => (r.versionCodes || []).map(String).includes(String(vc)) && r.status === 'completed')) {
      await play('DELETE', `/edits/${e.id}`)
      return 'already'
    }
    await play('PUT', `/edits/${e.id}/tracks/production`, { track: 'production', releases: [{
      name: `${name} (${vc})`, versionCodes: [String(vc)], status: 'completed',
      releaseNotes: Object.entries(NOTES).map(([language, text]) => ({ language, text })),
    }] })
    await play('POST', `/edits/${e.id}:commit`)
    log('committed production release')
  } catch (err) {
    await play('DELETE', `/edits/${e.id}`).catch(() => {})
    throw err
  }
  const e2 = await play('POST', '/edits')
  const p = await play('GET', `/edits/${e2.id}/tracks/production`)
  await play('DELETE', `/edits/${e2.id}`).catch(() => {})
  if (!(p.releases || []).some((r) => (r.versionCodes || []).map(String).includes(String(vc)) && r.status === 'completed')) fail('production release not visible')
  return 'released'
}
