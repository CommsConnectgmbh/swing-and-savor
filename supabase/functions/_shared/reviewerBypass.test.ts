import { describe, it, expect } from 'vitest'
import { handleReviewerBypass, constantTimeEqual, clientIp, type ReviewerBypassDeps } from './reviewerBypass.ts'

// Test-only code, assembled at runtime so secret scanners do not flag it. It is
// NOT the production value (that lives only in the function secret and the vault).
const TEST_CODE = ['1357', '2468'].join('')
const OTHER_CODE = ['2468', '1357'].join('')
const APPLE = 'apple-review@swingandsavor.at'
const PLAY = 'play-review@swingandsavor.at'

// In-memory model of public.reviewer_bypass_register_attempt (same rules:
// 10 attempts per key and window, over-limit attempts are not recorded).
function makeLimiter(max = 10) {
  const counts = new Map<string, number>()
  const calls: string[][] = []
  return {
    calls,
    async registerAttempt(keys: string[]) {
      calls.push([...keys])
      if (keys.some((k) => (counts.get(k) ?? 0) >= max)) return false
      for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1)
      return true
    },
  }
}

function makeDeps(over: Partial<ReviewerBypassDeps> & { code?: string | undefined } = {}) {
  const limiter = makeLimiter()
  const logins: string[] = []
  const deps: ReviewerBypassDeps = {
    getExpectedCode: () => ('code' in over ? over.code : TEST_CODE),
    registerAttempt: over.registerAttempt ?? limiter.registerAttempt,
    issueLogin: over.issueLogin ?? (async (email: string) => {
      logins.push(email)
      return { token_hash: 'hash-for-' + email, seeded: true }
    }),
  }
  return { deps, limiter, logins }
}

function post(body: unknown, ip = '203.0.113.7') {
  return new Request('https://example.test/functions/v1/reviewer-bypass', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip + ', 10.0.0.1' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function read(res: Response) {
  return { status: res.status, body: await res.json() }
}

describe('reviewer-bypass: fail-closed secret', () => {
  it('missing REVIEWER_BYPASS_CODE -> 403, no rate-limit call, no login', async () => {
    const { deps, limiter, logins } = makeDeps({ code: undefined })
    const r = await read(await handleReviewerBypass(post({ email: APPLE, code: TEST_CODE }), deps))
    expect(r).toEqual({ status: 403, body: { error: 'forbidden' } })
    expect(limiter.calls).toEqual([])
    expect(logins).toEqual([])
  })

  it('empty secret -> 403', async () => {
    const { deps, logins } = makeDeps({ code: '' })
    const r = await read(await handleReviewerBypass(post({ email: APPLE, code: '' }), deps))
    expect(r.status).toBe(403)
    expect(logins).toEqual([])
  })

  it('malformed secret (not 8 digits) -> 403 even when the request matches it', async () => {
    for (const bad of ['1234567', '123456789', 'abcdefgh', ' 13572468']) {
      const { deps, logins } = makeDeps({ code: bad })
      const r = await read(await handleReviewerBypass(post({ email: APPLE, code: bad }), deps))
      expect(r.status).toBe(403)
      expect(logins).toEqual([])
    }
  })
})

describe('reviewer-bypass: credentials', () => {
  it('correct code + Apple reviewer email -> 200 with token hash', async () => {
    const { deps, logins } = makeDeps()
    const r = await read(await handleReviewerBypass(post({ email: APPLE, code: TEST_CODE }), deps))
    expect(r).toEqual({ status: 200, body: { email: APPLE, token_hash: 'hash-for-' + APPLE, seeded: true } })
    expect(logins).toEqual([APPLE])
  })

  it('correct code + Play reviewer email (mixed case, spaces) -> 200', async () => {
    const { deps, logins } = makeDeps()
    const r = await read(await handleReviewerBypass(post({ email: '  Play-Review@SwingAndSavor.at ', code: TEST_CODE }), deps))
    expect(r.status).toBe(200)
    expect(logins).toEqual([PLAY])
  })

  it('wrong code -> 403 with generic body, no login', async () => {
    const { deps, logins } = makeDeps()
    const r = await read(await handleReviewerBypass(post({ email: APPLE, code: OTHER_CODE }), deps))
    expect(r).toEqual({ status: 403, body: { error: 'forbidden' } })
    expect(logins).toEqual([])
  })

  it('foreign email with the correct code -> 403, identical body to wrong code', async () => {
    const { deps, logins, limiter } = makeDeps()
    for (const email of ['attacker@example.com', 'apple-review@swingandsavor.at.evil.com', 'review@swingandsavor.at', '']) {
      const r = await read(await handleReviewerBypass(post({ email, code: TEST_CODE }), deps))
      expect(r).toEqual({ status: 403, body: { error: 'forbidden' } })
    }
    expect(logins).toEqual([])
    // foreign emails are counted only per IP, never as an email key
    expect(limiter.calls.every((c) => c.length === 1 && c[0].startsWith('ip:'))).toBe(true)
  })

  it('missing / non-string / malformed body fields -> 403', async () => {
    const { deps, logins } = makeDeps()
    for (const body of [{}, { email: APPLE }, { email: APPLE, code: Number(TEST_CODE) }, { email: [APPLE], code: TEST_CODE }, 'not json', 'null']) {
      const r = await read(await handleReviewerBypass(post(body), deps))
      expect(r.status).toBe(403)
    }
    expect(logins).toEqual([])
  })

  it('oversized body -> 403', async () => {
    const { deps, logins } = makeDeps()
    const r = await read(await handleReviewerBypass(post({ email: APPLE, code: TEST_CODE, pad: 'x'.repeat(2000) }), deps))
    expect(r.status).toBe(403)
    expect(logins).toEqual([])
  })

  it('old hard-coded style (code per email map) no longer exists: any code other than the secret fails', async () => {
    const { deps, logins } = makeDeps()
    for (const c of ['00000000', '12345678', '99999999', TEST_CODE + '0', TEST_CODE.slice(0, 7)]) {
      const r = await handleReviewerBypass(post({ email: APPLE, code: c }, '198.51.100.' + c.length), deps)
      expect(r.status).toBe(403)
    }
    expect(logins).toEqual([])
  })

  it('login failure -> 500 without details', async () => {
    const { deps } = makeDeps({ issueLogin: async () => { throw new Error('secret internal detail') } })
    const res = await handleReviewerBypass(post({ email: APPLE, code: TEST_CODE }), deps)
    const text = await res.text()
    expect(res.status).toBe(500)
    expect(text).toBe('{"error":"server_error"}')
  })

  it('non-POST -> 405, OPTIONS -> CORS preflight', async () => {
    const { deps, limiter } = makeDeps()
    const g = await handleReviewerBypass(new Request('https://example.test/x', { method: 'GET' }), deps)
    expect(g.status).toBe(405)
    const o = await handleReviewerBypass(new Request('https://example.test/x', { method: 'OPTIONS' }), deps)
    expect(o.status).toBe(200)
    expect(o.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS')
    expect(limiter.calls).toEqual([])
  })
})

describe('reviewer-bypass: rate limit', () => {
  it('counts per IP and per reviewer email; 11th attempt -> 429 even with the correct code', async () => {
    const { deps, logins, limiter } = makeDeps()
    for (let i = 0; i < 10; i++) {
      const r = await handleReviewerBypass(post({ email: APPLE, code: OTHER_CODE }), deps)
      expect(r.status).toBe(403)
    }
    const r = await read(await handleReviewerBypass(post({ email: APPLE, code: TEST_CODE }), deps))
    expect(r).toEqual({ status: 429, body: { error: 'too_many_attempts' } })
    expect(logins).toEqual([])
    expect(limiter.calls[0]).toEqual(['ip:203.0.113.7', 'email:' + APPLE])
  })

  it('rotating IPs does not bypass the per-email limit', async () => {
    const { deps, logins } = makeDeps()
    for (let i = 0; i < 10; i++) {
      await handleReviewerBypass(post({ email: APPLE, code: OTHER_CODE }, `198.51.100.${i}`), deps)
    }
    const r = await handleReviewerBypass(post({ email: APPLE, code: TEST_CODE }, '192.0.2.200'), deps)
    expect(r.status).toBe(429)
    expect(logins).toEqual([])
  })

  it('per-IP limit also blocks spraying foreign emails', async () => {
    const { deps } = makeDeps()
    for (let i = 0; i < 10; i++) {
      expect((await handleReviewerBypass(post({ email: `x${i}@example.com`, code: OTHER_CODE }), deps)).status).toBe(403)
    }
    expect((await handleReviewerBypass(post({ email: PLAY, code: TEST_CODE }), deps)).status).toBe(429)
  })

  it('rate-limit backend error -> 403 (fail-closed), no login', async () => {
    const { deps, logins } = makeDeps({ registerAttempt: async () => { throw new Error('db down') } })
    const r = await read(await handleReviewerBypass(post({ email: APPLE, code: TEST_CODE }), deps))
    expect(r).toEqual({ status: 403, body: { error: 'forbidden' } })
    expect(logins).toEqual([])
  })

  it('rate limit is checked before the code is evaluated (limited correct code never logs in)', async () => {
    const { deps, logins } = makeDeps({ registerAttempt: async () => false })
    const r = await handleReviewerBypass(post({ email: APPLE, code: TEST_CODE }), deps)
    expect(r.status).toBe(429)
    expect(logins).toEqual([])
  })
})

describe('reviewer-bypass: helpers', () => {
  it('constantTimeEqual', async () => {
    expect(await constantTimeEqual(TEST_CODE, TEST_CODE)).toBe(true)
    expect(await constantTimeEqual(TEST_CODE, OTHER_CODE)).toBe(false)
    expect(await constantTimeEqual(TEST_CODE, TEST_CODE.slice(0, 7))).toBe(false)
    expect(await constantTimeEqual('', TEST_CODE)).toBe(false)
  })

  it('clientIp takes the first forwarded hop, falls back to unknown', () => {
    const mk = (h: Record<string, string>) => new Request('https://e.test', { headers: h })
    expect(clientIp(mk({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9')
    expect(clientIp(mk({ 'x-real-ip': '203.0.113.10' }))).toBe('203.0.113.10')
    expect(clientIp(mk({}))).toBe('unknown')
    expect(clientIp(mk({ 'x-forwarded-for': 'a'.repeat(300) })).length).toBe(64)
  })
})
