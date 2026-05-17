// Lightweight referral tracking.
// 1. ?ref=XXXXXXXX in URL is captured to localStorage on first visit (pre-auth).
// 2. After signup the captured code is sent to the `claim-referral` Edge Function.
// 3. Profile owns a stable 8-char ref_code (generated server-side on profile insert).
//
// No PII in localStorage — only the 8-char code.

const STORAGE_KEY = 'sns_ref_code'

export function captureReferralFromUrl() {
  try {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const ref = (url.searchParams.get('ref') || '').trim().toUpperCase()
    if (!ref) return
    if (!/^[A-Z0-9]{6,12}$/.test(ref)) return
    // Don't overwrite if already captured — first-touch attribution
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, ref)
    }
    // Strip ?ref from URL so it doesn't get re-shared accidentally
    url.searchParams.delete('ref')
    window.history.replaceState({}, '', url.toString())
  } catch {}
}

export function getStoredReferralCode() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch { return null }
}

export function clearStoredReferralCode() {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

export function buildReferralLink(refCode) {
  if (!refCode) return 'https://swingandsavor.at'
  return `https://swingandsavor.at?ref=${encodeURIComponent(refCode)}`
}
