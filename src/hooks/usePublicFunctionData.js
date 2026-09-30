import { useEffect, useRef, useState } from 'react'
import { publicFunctionHeaders } from '../lib/functions'

// Every public (unauthenticated) read screen — cup, recap, season, crew,
// hall-of-fame, invitational, savor offer — hand-rolled the exact same effect:
//
//   const [data, setData] = useState(null)
//   const [loading, setLoading] = useState(true)
//   const [err, setErr] = useState(null)
//   useEffect(() => {
//     let cancelled = false
//     setLoading(true); setErr(null)
//     fetch(url, { headers: publicFunctionHeaders() })
//       .then(async (r) => {
//         const j = await r.json().catch(() => ({}))
//         if (cancelled) return
//         if (!r.ok) { setErr(j?.error || 'error'); setLoading(false); return }
//         setData(j); setLoading(false)
//       })
//       .catch((e) => { if (!cancelled) { setErr(String(e)); setLoading(false) } })
//     return () => { cancelled = true }
//   }, [key])
//
// The `cancelled` guard (so a late response can't setState after the screen
// navigated away) is easy to get subtly wrong — one screen even forgot to reset
// `err` before a new fetch. Centralising it here gives every public screen the
// same correct loading/error lifecycle from one place.

/**
 * Fetch a public Supabase Edge Function (anon-key headers) as a screen's
 * primary data.
 *
 * @param {string} url  Absolute edge-function URL including its query string.
 *                      A falsy value skips the fetch and stays in the loading
 *                      state (useful while a route param is still resolving).
 * @param {(json: any) => void} [onSuccess]  Optional side effect run with the
 *                      parsed JSON after a successful (2xx) response — e.g.
 *                      patching `document.title` / OG meta tags. Always invoked
 *                      with the latest closure, so passing a fresh inline
 *                      function every render does not re-trigger the fetch.
 * @returns {{ data: any, loading: boolean, err: string|null }}
 */
export function usePublicFunctionData(url, onSuccess) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  // Hold the success callback in a ref so the effect depends only on `url`;
  // otherwise a new inline `onSuccess` each render would refetch every render.
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess

  useEffect(() => {
    if (!url) return undefined
    let cancelled = false
    setLoading(true)
    setErr(null)
    fetch(url, { headers: publicFunctionHeaders() })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok) { setErr(j?.error || 'error'); setLoading(false); return }
        setData(j)
        onSuccessRef.current?.(j)
        setLoading(false)
      })
      .catch((e) => { if (!cancelled) { setErr(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [url])

  return { data, loading, err }
}
