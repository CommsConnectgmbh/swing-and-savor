// Single source of truth for "share a generated PNG via the Web Share API,
// falling back to a download".
//
// This exact routine was copy-pasted as `shareCard.js#shareOrDownload` and
// `cardRenderer.js#shareCard` — byte-identical apart from the function name and
// doc comment. Both now delegate here so the share/download behaviour (the
// `navigator.canShare` gate, `AbortError → 'cancelled'`, and the object-URL
// download + revoke fallback) cannot drift apart between the two card families.
//
// Resolves to one of: 'shared' | 'cancelled' | 'downloaded'.
export async function shareImageOrDownload({ blob, filename, title, text, url }) {
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text, url })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'
    }
  }
  // Fallback: download the file. Also the landing spot when the Web Share API
  // is present but rejects with a non-abort error (permission, unsupported
  // payload, …) — matching the original inlined behaviour.
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(objectUrl)
  return 'downloaded'
}
