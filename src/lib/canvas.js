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
