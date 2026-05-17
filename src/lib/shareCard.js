/**
 * Rendert eine Match-Recap-Card auf Canvas und gibt einen Blob + DataURL zurück.
 * Format 1080x1080 (Instagram-/WhatsApp-tauglich). Nutzt nur Canvas-Primitives,
 * keine externen Libraries → null Bundle-Overhead.
 */
const BG    = '#0d271e'
const SURF  = '#143024'
const EDGE  = '#1f3f2c'
const ACC   = '#98cd02'
const TEAMA = '#60a5fa'
const TEAMB = '#fb7185'
const INK   = '#ffffff'
const MUTED = '#a8b5ad'

function rounded(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y,     x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x,     y + h, rad)
  ctx.arcTo(x,     y + h, x,     y,     rad)
  ctx.arcTo(x,     y,     x + w, y,     rad)
  ctx.closePath()
}

function trunc(ctx, txt, maxW) {
  if (ctx.measureText(txt).width <= maxW) return txt
  let s = txt
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1)
  return s + '…'
}

export async function renderMatchShareCard({
  type, namesA, namesB, teamANameLabel, teamBNameLabel,
  scoreLine, statusLabel, courseName, cupName, ownerHandle,
}) {
  const SIZE = 1080
  const canvas = document.createElement('canvas')
  canvas.width = SIZE; canvas.height = SIZE
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = BG; ctx.fillRect(0, 0, SIZE, SIZE)

  // Top accent bar
  const grad = ctx.createLinearGradient(0, 0, SIZE, 0)
  grad.addColorStop(0, 'rgba(152,205,2,0.0)')
  grad.addColorStop(0.5, 'rgba(152,205,2,0.6)')
  grad.addColorStop(1, 'rgba(152,205,2,0.0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 60, SIZE, 4)

  // Brand
  ctx.fillStyle = ACC
  ctx.textAlign = 'center'
  ctx.font = '700 32px -apple-system, "Helvetica Neue", Arial'
  ctx.fillText('SWING & SAVOR', SIZE / 2, 140)

  ctx.fillStyle = MUTED
  ctx.font = '500 22px -apple-system, "Helvetica Neue", Arial'
  ctx.fillText((type || '').toUpperCase(), SIZE / 2, 180)

  // Center match card
  rounded(ctx, 80, 280, SIZE - 160, 520, 32)
  ctx.fillStyle = SURF; ctx.fill()
  ctx.strokeStyle = EDGE; ctx.lineWidth = 2; ctx.stroke()

  // Team A
  ctx.fillStyle = TEAMA
  ctx.font = '700 24px -apple-system, "Helvetica Neue", Arial'
  ctx.textAlign = 'left'
  ctx.fillText((teamANameLabel || 'TEAM A').toUpperCase(), 130, 360)

  ctx.fillStyle = INK
  ctx.font = '700 38px -apple-system, "Helvetica Neue", Arial'
  const labelA = (namesA || []).join(' · ') || '—'
  ctx.fillText(trunc(ctx, labelA, SIZE - 260), 130, 415)

  // VS line
  ctx.strokeStyle = EDGE; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(130, 470); ctx.lineTo(SIZE - 130, 470); ctx.stroke()
  ctx.fillStyle = MUTED
  ctx.textAlign = 'center'
  ctx.font = '700 22px -apple-system, "Helvetica Neue", Arial'
  ctx.fillText('VS', SIZE / 2, 478)

  // Team B
  ctx.fillStyle = TEAMB
  ctx.font = '700 24px -apple-system, "Helvetica Neue", Arial'
  ctx.textAlign = 'left'
  ctx.fillText((teamBNameLabel || 'TEAM B').toUpperCase(), 130, 540)

  ctx.fillStyle = INK
  ctx.font = '700 38px -apple-system, "Helvetica Neue", Arial'
  const labelB = (namesB || []).join(' · ') || '—'
  ctx.fillText(trunc(ctx, labelB, SIZE - 260), 130, 595)

  // Score-Box
  rounded(ctx, SIZE / 2 - 220, 640, 440, 130, 24)
  ctx.fillStyle = '#0d271e'; ctx.fill()
  ctx.strokeStyle = ACC; ctx.lineWidth = 2; ctx.stroke()
  ctx.fillStyle = ACC
  ctx.textAlign = 'center'
  ctx.font = '900 86px -apple-system, "Helvetica Neue", Arial'
  ctx.fillText(scoreLine || '—', SIZE / 2, 735)

  // Status pill
  ctx.fillStyle = MUTED
  ctx.font = '600 22px -apple-system, "Helvetica Neue", Arial'
  ctx.fillText((statusLabel || '').toUpperCase(), SIZE / 2, 790)

  // Course / Cup / Owner
  const meta = [courseName, cupName, ownerHandle ? `@${ownerHandle}` : null].filter(Boolean).join('  ·  ')
  if (meta) {
    ctx.fillStyle = MUTED
    ctx.font = '500 24px -apple-system, "Helvetica Neue", Arial'
    ctx.fillText(trunc(ctx, meta, SIZE - 160), SIZE / 2, 880)
  }

  // Footer URL
  ctx.fillStyle = ACC
  ctx.font = '700 26px -apple-system, "Helvetica Neue", Arial'
  ctx.fillText('swingandsavor.at', SIZE / 2, 1000)

  // Bottom accent bar
  ctx.fillStyle = grad
  ctx.fillRect(0, 1016, SIZE, 4)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve({ blob, dataUrl: canvas.toDataURL('image/png') })
    }, 'image/png', 0.95)
  })
}

/** Versucht Web-Share-API mit File, fällt zurück auf Download. */
export async function shareOrDownload({ blob, filename, title, text, url }) {
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text, url })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'
    }
  }
  // Fallback: Download
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(objectUrl)
  return 'downloaded'
}
