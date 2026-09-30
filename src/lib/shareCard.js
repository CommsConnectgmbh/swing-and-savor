/**
 * Rendert eine Match-Recap-Card auf Canvas und gibt einen Blob + DataURL zurück.
 * Format 1080x1080 (Instagram-/WhatsApp-tauglich). Nutzt nur Canvas-Primitives,
 * keine externen Libraries → null Bundle-Overhead.
 */
import { roundRect, fitText } from './canvas'

const BG    = '#0A1A12'
const SURF  = '#102822'
const EDGE  = '#1F4537'
const ACC   = '#D9C9A8'
const TEAMA = '#9BB5C9'
const TEAMB = '#D9A38E'
const INK   = '#F4F1EA'
const MUTED = '#9C968C'

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
  grad.addColorStop(0, 'rgba(217,201,168,0.0)')
  grad.addColorStop(0.5, 'rgba(217,201,168,0.6)')
  grad.addColorStop(1, 'rgba(217,201,168,0.0)')
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
  roundRect(ctx, 80, 280, SIZE - 160, 520, 32)
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
  ctx.fillText(fitText(ctx, labelA, SIZE - 260), 130, 415)

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
  ctx.fillText(fitText(ctx, labelB, SIZE - 260), 130, 595)

  // Score-Box
  roundRect(ctx, SIZE / 2 - 220, 640, 440, 130, 24)
  ctx.fillStyle = '#0A1A12'; ctx.fill()
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
    ctx.fillText(fitText(ctx, meta, SIZE - 160), SIZE / 2, 880)
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

/**
 * Ergebnis-Karte für eine Casual-Runde (Leaderboard, 1–6 Spieler).
 * rows = [{ name, total, sub, winner }]. Gleiche Bildsprache wie die Match-Card,
 * 1080×1080, WhatsApp-/Instagram-tauglich.
 */
export async function renderCasualShareCard({ title, statusLabel, rows, dateLabel, matchResult }) {
  const SIZE = 1080
  const canvas = document.createElement('canvas')
  canvas.width = SIZE; canvas.height = SIZE
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = BG; ctx.fillRect(0, 0, SIZE, SIZE)

  const grad = ctx.createLinearGradient(0, 0, SIZE, 0)
  grad.addColorStop(0, 'rgba(217,201,168,0.0)')
  grad.addColorStop(0.5, 'rgba(217,201,168,0.6)')
  grad.addColorStop(1, 'rgba(217,201,168,0.0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 60, SIZE, 4)

  // Brand
  ctx.fillStyle = ACC
  ctx.textAlign = 'center'
  ctx.font = '700 32px -apple-system, "Helvetica Neue", Arial'
  ctx.fillText('SWING & SAVOR', SIZE / 2, 140)
  ctx.fillStyle = MUTED
  ctx.font = '500 22px -apple-system, "Helvetica Neue", Arial'
  ctx.fillText('CASUAL', SIZE / 2, 180)

  // Title (course)
  ctx.fillStyle = INK
  ctx.font = '700 46px -apple-system, "Helvetica Neue", Arial'
  ctx.fillText(fitText(ctx, title || 'Casual-Runde', SIZE - 160), SIZE / 2, 250)

  // Leaderboard card
  const list = (rows || []).slice(0, 6)
  const rowH = 104
  const top = 300
  const cardH = Math.max(1, list.length) * rowH + 40
  roundRect(ctx, 80, top, SIZE - 160, cardH, 32)
  ctx.fillStyle = SURF; ctx.fill()
  ctx.strokeStyle = EDGE; ctx.lineWidth = 2; ctx.stroke()

  list.forEach((r, i) => {
    const y = top + 20 + i * rowH
    const cy = y + rowH / 2 - 10
    if (r.winner) {
      roundRect(ctx, 96, y + 8, SIZE - 192, rowH - 16, 20)
      ctx.fillStyle = 'rgba(217,201,168,0.10)'; ctx.fill()
    }
    // Rank
    ctx.beginPath(); ctx.arc(160, cy, 30, 0, Math.PI * 2)
    ctx.fillStyle = r.winner ? ACC : '#0A1A12'; ctx.fill()
    if (!r.winner) { ctx.strokeStyle = EDGE; ctx.lineWidth = 2; ctx.stroke() }
    ctx.fillStyle = r.winner ? '#0A1A12' : MUTED
    ctx.textAlign = 'center'
    ctx.font = '800 30px -apple-system, "Helvetica Neue", Arial'
    ctx.fillText(String(i + 1), 160, cy + 11)
    // Name + sub
    ctx.textAlign = 'left'
    ctx.fillStyle = INK
    ctx.font = '700 40px -apple-system, "Helvetica Neue", Arial'
    ctx.fillText(fitText(ctx, r.name || '—', 540), 220, cy - 2)
    if (r.sub) {
      ctx.fillStyle = MUTED
      ctx.font = '500 24px -apple-system, "Helvetica Neue", Arial'
      ctx.fillText(fitText(ctx, r.sub, 560), 220, cy + 34)
    }
    // Total
    ctx.textAlign = 'right'
    ctx.fillStyle = r.winner ? ACC : INK
    ctx.font = '900 60px -apple-system, "Helvetica Neue", Arial'
    ctx.fillText(r.total != null && r.total > 0 ? String(r.total) : '—', SIZE - 130, cy + 16)
  })

  let cursorY = top + cardH + 40

  // Lochspiel-Ergebnis (nur bei Match-Play): wer mit wie vielen Löchern.
  if (matchResult) {
    const bx = 100, bw = SIZE - 200, bh = 150
    roundRect(ctx, bx, cursorY, bw, bh, 24)
    ctx.fillStyle = '#0A1A12'; ctx.fill()
    ctx.strokeStyle = ACC; ctx.lineWidth = 2; ctx.stroke()
    ctx.textAlign = 'left'
    ctx.fillStyle = MUTED
    ctx.font = '700 22px -apple-system, "Helvetica Neue", Arial'
    ctx.fillText('LOCHSPIEL', bx + 40, cursorY + 48)
    ctx.fillStyle = INK
    ctx.font = '700 42px -apple-system, "Helvetica Neue", Arial'
    ctx.fillText(fitText(ctx, matchResult.text || '—', bw - 280), bx + 40, cursorY + 96)
    if (matchResult.sub) {
      ctx.fillStyle = MUTED
      ctx.font = '500 22px -apple-system, "Helvetica Neue", Arial'
      ctx.fillText(fitText(ctx, matchResult.sub, bw - 80), bx + 40, cursorY + 130)
    }
    if (matchResult.label) {
      ctx.textAlign = 'right'
      ctx.fillStyle = ACC
      ctx.font = '900 66px -apple-system, "Helvetica Neue", Arial'
      ctx.fillText(matchResult.label, bx + bw - 40, cursorY + 92)
    }
    cursorY += bh + 40
  }

  // Status + date
  ctx.textAlign = 'center'
  ctx.fillStyle = MUTED
  ctx.font = '600 24px -apple-system, "Helvetica Neue", Arial'
  const footMeta = [String(statusLabel || '').toUpperCase(), dateLabel].filter(Boolean).join('  ·  ')
  ctx.fillText(fitText(ctx, footMeta, SIZE - 160), SIZE / 2, cursorY + 30)

  // Footer URL
  ctx.fillStyle = ACC
  ctx.font = '700 26px -apple-system, "Helvetica Neue", Arial'
  ctx.fillText('swingandsavor.at', SIZE / 2, 1000)
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
