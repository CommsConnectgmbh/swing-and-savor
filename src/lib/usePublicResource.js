import { useEffect, useRef, useState } from 'react'
import { functionUrl, publicFunctionHeaders } from './functions'

// Every public share screen (cup, invitational, recap, hall, crew, season)
// hand-rolled the same data-loading block: a `cancelled` flag, setLoading(true)
// + setErr(null), a fetch() with publicFunctionHeaders(), a
// `r.json().catch(() => ({}))` body read, an `if (!r.ok) setErr(j?.error ||
// 'error')` branch, and a cleanup that flips the flag. Six near-identical
// copies meant six chances for the cancellation guard or error shape to drift.
//
// usePublicResource centralises that lifecycle so each screen only declares
// *what* to fetch and (optionally) which side effect to run on success. The
// observable behaviour — loading starts true, errors surface the server's
// `error` field, in-flight requests are ignored after unmount/param change —
// is identical to the code it replaces.

function buildQuery(params) {
  const parts = Object.entries(params || {})
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

/**
 * Fetch a public (anon-key) Supabase Edge Function and track its
 * loading / data / error lifecycle with request cancellation.
 *
 * @param {string} name   Edge-function name, e.g. 'public-cup'.
 * @param {Object} params Query params appended to the request URL. Nullish and
 *                        empty-string values are dropped. The effect re-runs
 *                        whenever a serialised param value changes.
 * @param {Object} [opts]
 * @param {(json:any)=>void} [opts.onLoad] Side effect run once per successful
 *        load (e.g. patching document.title / OG meta). Receives the parsed
 *        JSON body. Always reads the latest closure without re-triggering the
 *        fetch.
 * @returns {{ data:any, loading:boolean, error:(string|null) }}
 */
export function usePublicResource(name, params, { onLoad } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Keep onLoad in a ref so a fresh callback identity each render never
  // re-runs the fetch — only `name` and the param values should do that.
  const onLoadRef = useRef(onLoad)
  onLoadRef.current = onLoad

  const query = buildQuery(params)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`${functionUrl(name)}${query}`, { headers: publicFunctionHeaders() })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok) { setError(j?.error || 'error'); setLoading(false); return }
        setData(j)
        setLoading(false)
        if (onLoadRef.current) onLoadRef.current(j)
      })
      .catch((e) => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [name, query])

  return { data, loading, error }
}
