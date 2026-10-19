// Request handling for the reviewer-bypass Edge Function, kept free of Deno-
// and network-specific imports so it can be tested with vitest.
//
// Security model (fail-closed):
//   1. The code comes only from the REVIEWER_BYPASS_CODE secret. If it is
//      missing or not exactly 8 digits, every request is rejected with 403
//      before any database access, service-role client, magic link or seeding.
//   2. Every request is counted in a durable, database-backed rate limit
//      (per client IP and per reviewer email). If the limit check fails for
//      any reason, the request is rejected (403); if the limit is reached, 429.
//   3. Only the two reviewer addresses are accepted. Email and code are both
//      evaluated before deciding, and the code is compared in constant time.
//   4. Error responses never say which check failed.

export const ALLOWED_REVIEWER_EMAILS: ReadonlySet<string> = new Set([
  "apple-review@swingandsavor.at",
  "play-review@swingandsavor.at",
])

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const MAX_BODY_BYTES = 1024
const CODE_FORMAT = /^[0-9]{8}$/

export interface ReviewerBypassDeps {
  /** Value of the REVIEWER_BYPASS_CODE secret (undefined when unset). */
  getExpectedCode(): string | undefined
  /**
   * Records one attempt for every key and returns true when the request may
   * proceed, false when any key is over its limit. Throws on any error.
   */
  registerAttempt(keys: string[]): Promise<boolean>
  /** Issues the magic-link token hash for an authenticated reviewer. Throws on error. */
  issueLogin(email: string): Promise<{ token_hash: string; seeded: boolean }>
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}

const forbidden = () => json(403, { error: "forbidden" })

/** Constant-time comparison: both values are hashed first, so neither content nor length leaks through timing. */
export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder()
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ])
  const va = new Uint8Array(da)
  const vb = new Uint8Array(db)
  let diff = 0
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i]
  return diff === 0
}

/** Client IP as seen by the Supabase edge gateway (first x-forwarded-for hop). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? ""
  const first = fwd.split(",")[0]?.trim() ?? ""
  const ip = first || (req.headers.get("x-real-ip") ?? "").trim()
  return (ip || "unknown").slice(0, 64)
}

export async function handleReviewerBypass(req: Request, deps: ReviewerBypassDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" })

  // Fail-closed: without a well-formed secret the reviewer login does not exist.
  const expected = deps.getExpectedCode()
  if (!expected || !CODE_FORMAT.test(expected)) return forbidden()

  let raw: string
  try {
    raw = await req.text()
  } catch {
    return forbidden()
  }
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return forbidden()

  let body: unknown = null
  try { body = JSON.parse(raw) } catch { /* invalid JSON is handled below */ }
  const rec = (body && typeof body === "object") ? body as Record<string, unknown> : {}
  const email = typeof rec.email === "string" ? rec.email.toLowerCase().trim() : ""
  const code = typeof rec.code === "string" ? rec.code.trim() : ""

  const emailAllowed = ALLOWED_REVIEWER_EMAILS.has(email)
  const keys = ["ip:" + clientIp(req)]
  if (emailAllowed) keys.push("email:" + email)

  let mayProceed: boolean
  try {
    mayProceed = await deps.registerAttempt(keys)
  } catch {
    return forbidden()
  }
  if (!mayProceed) return json(429, { error: "too_many_attempts" })

  const codeOk = await constantTimeEqual(code, expected)
  if (!emailAllowed || !codeOk) return forbidden()

  try {
    const { token_hash, seeded } = await deps.issueLogin(email)
    return json(200, { email, token_hash, seeded })
  } catch {
    return json(500, { error: "server_error" })
  }
}
