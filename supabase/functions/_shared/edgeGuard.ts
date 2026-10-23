// Shared guards for public Edge Functions: real-user check, admin check and
// the durable rate limit (migration 043, edge_rate_limit_register).
//
// verify_jwt=true is satisfied by the public anon key, so functions that cost
// money or write shared data must check for a real user themselves.

export const ADMIN_EMAIL = 'rainer.roloff@comms-connect.de'

export interface GuardUser { id: string; email: string | null }

// Minimal structural type of the supabase-js client parts used here.
export interface AuthClient {
  auth: { getUser(jwt: string): Promise<{ data: { user: { id: string; email?: string | null } | null }; error: unknown }> }
}
export interface RpcClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
}

export function bearer(req: Request): string {
  const h = req.headers.get('Authorization') || ''
  return h.startsWith('Bearer ') ? h.slice(7).trim() : ''
}

/** The signed-in user behind the request, or null (anon key, expired, missing). */
export async function requireUser(req: Request, client: AuthClient): Promise<GuardUser | null> {
  const jwt = bearer(req)
  if (!jwt) return null
  try {
    const { data, error } = await client.auth.getUser(jwt)
    if (error || !data?.user?.id) return null
    return { id: data.user.id, email: data.user.email ?? null }
  } catch {
    return null
  }
}

export function isAdmin(user: GuardUser | null): boolean {
  return !!user?.email && user.email.toLowerCase() === ADMIN_EMAIL
}

/** Client IP as seen by the Supabase edge gateway (first x-forwarded-for hop). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? ''
  const first = fwd.split(',')[0]?.trim() ?? ''
  const ip = first || (req.headers.get('x-real-ip') ?? '').trim()
  return (ip || 'unknown').slice(0, 64)
}

/**
 * Registers one request under the given keys ("<bucket>:<value>").
 * true = allowed, false = limit reached. Throws when the limiter is
 * unavailable so callers fail closed.
 */
export async function registerRateLimit(admin: RpcClient, keys: string[]): Promise<boolean> {
  const { data, error } = await admin.rpc('edge_rate_limit_register', { p_keys: keys })
  if (error || typeof data !== 'boolean') throw new Error('rate_limit_unavailable')
  return data
}
