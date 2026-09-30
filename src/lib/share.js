// Cross-platform share helpers.
// Web-Share API on iOS Safari / Android Chrome; falls back to a manual sheet of share targets.

// The current page's URL, guarded for non-browser (SSR / prerender) contexts
// where `window` is undefined. Used as the default share target on the public
// pages (cup, recap, invitational, season, crew, hall-of-fame, Savor offer),
// which each previously inlined this exact guard. Centralising it keeps the
// SSR fallback ('') consistent and prevents a new share page from forgetting it.
export function currentUrl() {
  return typeof window !== 'undefined' ? window.location.href : ''
}

export function canNativeShare() {
  try { return typeof navigator !== 'undefined' && typeof navigator.share === 'function' } catch { return false }
}

export async function nativeShare({ title, text, url }) {
  if (!canNativeShare()) return false
  try {
    await navigator.share({ title, text, url })
    return true
  } catch (e) {
    if (e && e.name === 'AbortError') return true
    return false
  }
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      return true
    } catch { return false }
  }
}

// Build per-platform share URLs (fallback when native share is not available)
export function shareTargets({ url, text }) {
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(text)
  return [
    { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${t}%20${u}` },
    { id: 'telegram', label: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${t}` },
    { id: 'twitter',  label: 'X',        href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    { id: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { id: 'email',    label: 'Email',    href: `mailto:?subject=${encodeURIComponent('Swing & Savor')}&body=${t}%20${u}` },
  ]
}
