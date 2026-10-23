import { describe, it, expect } from 'vitest'
import { iosSubmit, iosVerify, playCheck, playProduction } from './storeRelease.mjs'

const CODE = '12345678'
const noSleep = async () => {}

// Stateful fake of the App Store Connect API (only the endpoints used).
function fakeAsc({ build = 'VALID', version = null, subs = [{ id: 's1', state: 'READY_FOR_REVIEW', items: 0 }], afterSubmit = 'WAITING_FOR_REVIEW', linkOther = false } = {}) {
  const st = { version, linked: null, calls: [], subs: subs.map((s) => ({ ...s })), submitted: false, review: null }
  const api = async (path, init = {}) => {
    const m = init.method || 'GET'
    const body = init.body ? JSON.parse(init.body).data : null
    st.calls.push(`${m} ${path.split('?')[0]}`)
    if (path.startsWith('/v1/builds?')) return { data: build ? [{ id: 'b19', attributes: { processingState: build } }] : [] }
    if (path.includes('/appStoreVersions?filter')) return { data: st.version ? [st.version] : [] }
    if (m === 'POST' && path === '/v1/appStoreVersions') { st.version = { id: 'v1', attributes: { ...body.attributes, appStoreState: 'PREPARE_FOR_SUBMISSION' } }; return { data: st.version } }
    if (m === 'PATCH' && path === '/v1/appStoreVersions/v1') { Object.assign(st.version.attributes, body.attributes); return {} }
    if (path === '/v1/appStoreVersions/v1') return { data: st.version }
    if (path === '/v1/appStoreVersions/v1/build') return { data: st.linked ? { id: st.linked } : null }
    if (path === '/v1/appStoreVersions/v1/appStoreVersionLocalizations') return { data: [{ id: 'l1', attributes: { locale: 'de-DE' } }] }
    if (path.startsWith('/v1/appStoreVersionLocalizations/')) return {}
    if (path === '/v1/appStoreVersions/v1/appStoreReviewDetail') throw new Error('404')
    if (path === '/v1/appStoreReviewDetails') { st.review = body.attributes; return {} }
    if (path === '/v1/appStoreVersions/v1/relationships/build') { st.linked = linkOther ? 'b18' : body.id; return {} }
    if (path.includes('/reviewSubmissions?')) return { data: st.subs.map((s) => ({ id: s.id, attributes: { state: s.state } })) }
    if (path.endsWith('/items')) { const s = st.subs.find((x) => path.includes(x.id)); return { data: Array(s.items).fill({}) } }
    if (m === 'POST' && path === '/v1/reviewSubmissions') { st.subs.push({ id: 'new', state: 'READY_FOR_REVIEW', items: 0 }); return { data: { id: 'new' } } }
    if (path === '/v1/reviewSubmissionItems') { st.item = body.relationships.reviewSubmission.data.id; return {} }
    if (m === 'PATCH' && path.startsWith('/v1/reviewSubmissions/')) { st.submitted = true; st.version.attributes.appStoreState = afterSubmit; return {} }
    throw new Error('unexpected ' + m + ' ' + path)
  }
  return { api, st }
}

describe('iosSubmit', () => {
  it('creates the version, binds build 19, sets review details, re-uses the empty submission', async () => {
    const { api, st } = fakeAsc()
    expect(await iosSubmit(api, '1.2.0', '19', CODE, { sleep: noSleep })).toBe('submitted')
    expect(st.version.attributes.releaseType).toBe('AFTER_APPROVAL')
    expect(st.linked).toBe('b19')
    expect(st.item).toBe('s1')
    expect(st.review.demoAccountPassword).toBe(CODE)
    expect(st.review.notes).toContain(CODE)
  })

  it('fails closed without a valid reviewer code, before any call', async () => {
    const { api, st } = fakeAsc()
    await expect(iosSubmit(api, '1.2.0', '19', '', { sleep: noSleep })).rejects.toThrow(/reviewer code/)
    await expect(iosSubmit(api, '1.2.0', '19', '1234', { sleep: noSleep })).rejects.toThrow(/reviewer code/)
    expect(st.calls).toEqual([])
  })

  it('fails when the build never becomes VALID or is INVALID', async () => {
    await expect(iosSubmit(fakeAsc({ build: 'PROCESSING' }).api, '1.2.0', '19', CODE, { sleep: noSleep, buildPolls: 3 })).rejects.toThrow(/VALID/)
    await expect(iosSubmit(fakeAsc({ build: 'INVALID' }).api, '1.2.0', '19', CODE, { sleep: noSleep })).rejects.toThrow(/INVALID/)
  })

  it('does not accept PENDING_DEVELOPER_RELEASE or a manual release as success', async () => {
    const pend = fakeAsc({ version: { id: 'v1', attributes: { appStoreState: 'PENDING_DEVELOPER_RELEASE', releaseType: 'MANUAL' } } })
    await expect(iosSubmit(pend.api, '1.2.0', '19', CODE, { sleep: noSleep })).rejects.toThrow(/PENDING_DEVELOPER_RELEASE/)
  })

  it('already in review counts only with the same build and automatic release', async () => {
    const ok = fakeAsc({ version: { id: 'v1', attributes: { appStoreState: 'WAITING_FOR_REVIEW', releaseType: 'AFTER_APPROVAL' } } })
    ok.st.linked = 'b19'
    expect(await iosSubmit(ok.api, '1.2.0', '19', CODE, { sleep: noSleep })).toBe('already')
    const other = fakeAsc({ version: { id: 'v1', attributes: { appStoreState: 'WAITING_FOR_REVIEW', releaseType: 'MANUAL' } } })
    other.st.linked = 'b19'
    await expect(iosSubmit(other.api, '1.2.0', '19', CODE, { sleep: noSleep })).rejects.toThrow(/not with build/)
  })

  it('fails if the linked build is not the expected one after submit', async () => {
    const { api } = fakeAsc({ linkOther: true })
    await expect(iosSubmit(api, '1.2.0', '19', CODE, { sleep: noSleep })).rejects.toThrow(/did not reach review/)
  })

  it('creates a submission when none is empty and refuses while another is in review', async () => {
    const full = fakeAsc({ subs: [{ id: 's1', state: 'READY_FOR_REVIEW', items: 1 }] })
    await iosSubmit(full.api, '1.2.0', '19', CODE, { sleep: noSleep })
    expect(full.st.item).toBe('new')
    const busy = fakeAsc({ subs: [{ id: 's9', state: 'WAITING_FOR_REVIEW', items: 1 }] })
    await expect(iosSubmit(busy.api, '1.2.0', '19', CODE, { sleep: noSleep })).rejects.toThrow(/another submission/)
  })

  it('iosVerify requires state, build and release type', async () => {
    const { api, st } = fakeAsc({ version: { id: 'v1', attributes: { appStoreState: 'WAITING_FOR_REVIEW', releaseType: 'AFTER_APPROVAL' } } })
    expect((await iosVerify(api, 'v1', 'b19')).ok).toBe(false)
    st.linked = 'b19'
    expect((await iosVerify(api, 'v1', 'b19')).ok).toBe(true)
  })
})

function fakePlay({ bundles = ['1', '2'], internal = ['2'], prod = [{ versionCodes: ['1'], status: 'completed' }], commitFails = false } = {}) {
  const st = { prod: prod.map((r) => ({ ...r })), staged: null, deleted: 0, commits: 0 }
  const play = async (m, path, data) => {
    if (m === 'POST' && path === '/edits') return { id: 'e' }
    if (m === 'DELETE') { st.deleted++; st.staged = null; return {} }
    if (path.endsWith('/bundles')) return { bundles: bundles.map((v) => ({ versionCode: Number(v) })) }
    if (path.endsWith('/tracks/internal')) return { releases: [{ versionCodes: internal, status: 'completed' }] }
    if (m === 'GET' && path.endsWith('/tracks/production')) return { releases: st.prod }
    if (m === 'PUT' && path.endsWith('/tracks/production')) { st.staged = data.releases; return {} }
    if (path.endsWith(':commit')) { if (commitFails) throw new Error('commit 400'); st.prod = st.staged; st.commits++; return {} }
    throw new Error('unexpected ' + m + ' ' + path)
  }
  return { play, st }
}

describe('play', () => {
  it('playCheck needs the bundle uploaded and on internal', async () => {
    expect((await playCheck(fakePlay().play, '2')).ok).toBe(true)
    expect((await playCheck(fakePlay({ internal: ['1'] }).play, '2')).ok).toBe(false)
    expect((await playCheck(fakePlay({ bundles: ['1'] }).play, '2')).ok).toBe(false)
  })

  it('playProduction rolls out 100 % and verifies', async () => {
    const { play, st } = fakePlay()
    expect(await playProduction(play, '2', '1.2.0')).toBe('released')
    expect(st.prod).toEqual([expect.objectContaining({ versionCodes: ['2'], status: 'completed', name: '1.2.0 (2)' })])
  })

  it('playProduction refuses a missing bundle and discards the edit on commit errors', async () => {
    await expect(playProduction(fakePlay({ bundles: ['1'] }).play, '2', '1.2.0')).rejects.toThrow(/not uploaded/)
    const f = fakePlay({ commitFails: true })
    await expect(playProduction(f.play, '2', '1.2.0')).rejects.toThrow(/commit/)
    expect(f.st.deleted).toBeGreaterThan(0)
  })

  it('playProduction is idempotent', async () => {
    const { play, st } = fakePlay({ prod: [{ versionCodes: ['2'], status: 'completed' }] })
    expect(await playProduction(play, '2', '1.2.0')).toBe('already')
    expect(st.commits).toBe(0)
  })
})
