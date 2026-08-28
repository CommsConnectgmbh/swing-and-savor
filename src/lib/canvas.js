// Shared Canvas 2D primitives used by the share-card / QR renderers.
// Pure helpers, no external dependencies.

/**
 * Trace a rounded-rectangle path (caller is responsible for fill/stroke).
 * The radius is clamped so it never exceeds half the width/height.
 */
export function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y,     x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x,     y + h, rad)
  ctx.arcTo(x,     y + h, x,     y,     rad)
  ctx.arcTo(x,     y,     x + w, y,     rad)
  ctx.closePath()
}

/**
 * Load an image with CORS enabled so it can be drawn onto a canvas that
 * later needs to be exported (toDataURL / toBlob) without tainting it.
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Truncate a single line of text with a trailing ellipsis so it fits within
 * maxWidth for the context's current font. Returns the text unchanged when it
 * already fits. Caller must set `ctx.font` before measuring.
 */
export function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let s = text
  while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) s = s.slice(0, -1)
  return s + '…'
}

/**
 * Export a canvas to a PNG, resolving with both the Blob (for sharing/upload)
 * and a data URL (for inline <img> previews).
 */
export function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve({ blob, dataUrl: canvas.toDataURL('image/png') })
    }, 'image/png', 0.95)
  })
}

/**
 * Share a generated PNG via the Web Share API (with the file attached) and
 * fall back to a plain download when sharing is unavailable or declined.
 * Returns 'shared' | 'cancelled' | 'downloaded'.
 */
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
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(objectUrl)
  return 'downloaded'
}
