// Canvas-based Winner-Card and Story-Overlay renderer for Swing & Savor.
// No external dependencies — pure Canvas 2D so the bundle stays lean.
//
// Templates:
//   - storyOverlay  → 1080×1920 PNG with TRANSPARENT background (Strava-style).
//                     Designed to be placed on top of the user's own Instagram-Story photo.
//   - championCard  → 1080×1080 solid Dark-Luxury card (Feed / WhatsApp).
//   - portraitCard  → 1080×1350 solid vertical card (WhatsApp / Pinterest).

import { roundRect, loadImage } from './canvas'
import { shareImageOrDownload } from './shareImage'

const CHAMPAGNE      = '#D9C9A8'
const CHAMPAGNE_DEEP = '#A8956A'
const BONE           = '#F4F1EA'
const INK            = '#0A1A12'
const HAIRLINE       = 'rgba(244,241,234,0.18)'

function loadFont(family, weight = 500) {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve()
  try { return document.fonts.load(`${weight} 64px "${family}"`) } catch { return Promise.resolve() }
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let s = text
  while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) s = s.slice(0, -1)
  return s + '…'
}

function bottomBrand(ctx, w, h, opts = {}) {
  const color = opts.color || CHAMPAGNE
  const muted = opts.muted || 'rgba(244,241,234,0.62)'

  // S·S monogram bottom-left
  ctx.fillStyle = color
  ctx.font = '600 56px "Fraunces", Georgia, serif'
  ctx.textAlign = 'left'
  ctx.fillText('S', 60, h - 60)
  ctx.fillText('·', 100, h - 60)
  ctx.fillText('S', 124, h - 60)

  // Powered-by line
  ctx.fillStyle = muted
  ctx.font = '500 22px "Inter", sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('SWING & SAVOR', w - 60, h - 60)

  // Tiny gold dot above brand
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(w - 28, h - 70, 4, 0, Math.PI * 2)
  ctx.fill()
}

function statBlock(ctx, x, y, label, value, opts = {}) {
  const labelColor = opts.labelColor || 'rgba(244,241,234,0.65)'
  const valueColor = opts.valueColor || BONE
  ctx.textAlign = 'left'

  ctx.fillStyle = labelColor
  ctx.font = '500 22px "Inter", sans-serif'
  ctx.fillText(label.toUpperCase(), x, y)

  ctx.fillStyle = valueColor
  ctx.font = `500 ${opts.fontSize || 92}px "Fraunces", Georgia, serif`
  ctx.fillText(String(value), x, y + (opts.fontSize ? opts.fontSize + 16 : 108))
}

/**
 * Story-Overlay (1080×1920, transparent BG).
 * The Strava trick: stats sit at the bottom of the canvas so the top 60-70 %
 * stay free for the user's golf photo on Instagram.
 */
export async function renderStoryOverlay({
  playerName,        // e.g. "Tiger W."
  score,             // e.g. "-3" or "75"
  scoreLabel,        // e.g. "Score", "Net"
  birdies,           // number
  longestDrive,      // e.g. "287 y"
  closestToPin,      // e.g. "1.2 m"
  cupName,           // e.g. "Founder Invitational"
  courseName,        // e.g. "Pebble Beach"
  dateLabel,         // e.g. "18 May 2026"
  isChampion = false,
}) {
  await Promise.all([
    loadFont('Fraunces', 500), loadFont('Fraunces', 600),
    loadFont('Inter', 500),    loadFont('Inter', 600),
  ])

  const W = 1080
  const H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, W, H)

  // Top eyebrow label (Champagne, centered)
  ctx.textAlign = 'center'
  ctx.fillStyle = CHAMPAGNE
  ctx.font = '500 28px "Inter", sans-serif'
  const eyebrow = (isChampion ? 'CHAMPION' : 'ROUND OF')
  ctx.fillText(eyebrow, W / 2, 110)

  // Tiny rule
  ctx.strokeStyle = 'rgba(217,201,168,0.55)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(W / 2 - 60, 130); ctx.lineTo(W / 2 + 60, 130); ctx.stroke()

  // Cup name + course (top section, leaves photo room below)
  if (cupName) {
    ctx.fillStyle = BONE
    ctx.font = '500 56px "Fraunces", Georgia, serif'
    ctx.fillText(fitText(ctx, cupName, W - 120), W / 2, 200)
  }
  if (courseName || dateLabel) {
    ctx.fillStyle = 'rgba(244,241,234,0.72)'
    ctx.font = '500 24px "Inter", sans-serif'
    const sub = [courseName, dateLabel].filter(Boolean).join('  ·  ')
    ctx.fillText(fitText(ctx, sub, W - 160), W / 2, 244)
  }

  // ===== STATS PANEL — bottom of canvas (so photo above is fully visible) =====
  // Subtle dark backplate so stats stay readable on any photo behind them.
  const PANEL_TOP = 1180
  const PANEL_H   = H - PANEL_TOP

  // Multi-stop gradient: transparent at top → near-black at bottom
  const grad = ctx.createLinearGradient(0, PANEL_TOP, 0, H)
  grad.addColorStop(0,    'rgba(10,10,10,0.0)')
  grad.addColorStop(0.35, 'rgba(10,10,10,0.65)')
  grad.addColorStop(1,    'rgba(10,10,10,0.92)')
  ctx.fillStyle = grad
  ctx.fillRect(0, PANEL_TOP, W, PANEL_H)

  // Hairline divider top of panel
  ctx.strokeStyle = HAIRLINE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(60, PANEL_TOP + 2); ctx.lineTo(W - 60, PANEL_TOP + 2); ctx.stroke()

  // Player name + meta
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(244,241,234,0.65)'
  ctx.font = '500 22px "Inter", sans-serif'
  ctx.fillText('PLAYER', 60, PANEL_TOP + 60)
  ctx.fillStyle = BONE
  ctx.font = '500 60px "Fraunces", Georgia, serif'
  ctx.fillText(fitText(ctx, playerName || '—', W - 120), 60, PANEL_TOP + 130)

  // Hero stat — large
  statBlock(ctx, 60, PANEL_TOP + 230, scoreLabel || 'SCORE', score ?? '—', {
    valueColor: CHAMPAGNE, fontSize: 168,
  })

  // Side stats — small triplet
  const sideStats = [
    { label: 'Birdies',       value: birdies ?? '—' },
    { label: 'Longest Drive', value: longestDrive ?? '—' },
    { label: 'Closest to Pin', value: closestToPin ?? '—' },
  ]
  sideStats.forEach((s, i) => {
    const y = PANEL_TOP + 290 + i * 110
    ctx.fillStyle = 'rgba(244,241,234,0.62)'
    ctx.font = '500 20px "Inter", sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(s.label.toUpperCase(), W - 60, y)
    ctx.fillStyle = BONE
    ctx.font = '500 56px "Fraunces", Georgia, serif'
    ctx.fillText(String(s.value), W - 60, y + 60)
  })

  // Bottom S·S brand + powered-by
  bottomBrand(ctx, W, H)

  return await canvasToBlob(canvas)
}

/**
 * Champion Card (1080×1080, solid Dark Luxury).
 * Used as Feed / WhatsApp share where transparency doesn't matter.
 */
export async function renderChampionCard({
  championName,
  award,             // e.g. "Founder Invitational Winner", "Rivalry Winner"
  cupName,
  courseName,
  dateLabel,
  score,
  scoreLabel = 'FINAL SCORE',
  sponsorName,       // optional, dezent
  avatarUrl,         // optional — drawn as circle in top-third
}) {
  await Promise.all([
    loadFont('Fraunces', 500), loadFont('Fraunces', 600), loadFont('Inter', 500),
  ])

  const W = 1080, H = 1080
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  // Off-Black background
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, W, H)

  // Champagne radial glow top-center
  const glow = ctx.createRadialGradient(W / 2, -60, 40, W / 2, -60, 720)
  glow.addColorStop(0, 'rgba(217,201,168,0.20)')
  glow.addColorStop(1, 'rgba(217,201,168,0.00)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Top eyebrow
  ctx.textAlign = 'center'
  ctx.fillStyle = CHAMPAGNE
  ctx.font = '500 24px "Inter", sans-serif'
  ctx.fillText((award || 'CHAMPION').toUpperCase(), W / 2, 110)

  ctx.strokeStyle = HAIRLINE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(W / 2 - 60, 132); ctx.lineTo(W / 2 + 60, 132); ctx.stroke()

  // Avatar circle (optional)
  let textTop = 220
  if (avatarUrl) {
    try {
      const img = await loadImage(avatarUrl)
      const size = 200
      const cx = W / 2, cy = 250
      ctx.save()
      ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip()
      ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size)
      ctx.restore()
      ctx.strokeStyle = CHAMPAGNE
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.stroke()
      textTop = 410
    } catch (_) { /* fall through */ }
  }

  // Player name — Fraunces display
  ctx.fillStyle = BONE
  ctx.font = '500 88px "Fraunces", Georgia, serif'
  ctx.fillText(fitText(ctx, championName || '—', W - 120), W / 2, textTop)

  // Cup name (smaller)
  ctx.fillStyle = 'rgba(244,241,234,0.78)'
  ctx.font = '500 28px "Inter", sans-serif'
  if (cupName) ctx.fillText(fitText(ctx, cupName, W - 160), W / 2, textTop + 60)

  // Score block
  const scoreY = textTop + 180
  ctx.fillStyle = 'rgba(244,241,234,0.55)'
  ctx.font = '500 22px "Inter", sans-serif'
  ctx.fillText(scoreLabel.toUpperCase(), W / 2, scoreY)
  ctx.fillStyle = CHAMPAGNE
  ctx.font = '500 180px "Fraunces", Georgia, serif'
  ctx.fillText(String(score ?? '—'), W / 2, scoreY + 170)

  // Meta line
  const meta = [courseName, dateLabel].filter(Boolean).join('  ·  ')
  if (meta) {
    ctx.fillStyle = 'rgba(244,241,234,0.62)'
    ctx.font = '500 22px "Inter", sans-serif'
    ctx.fillText(meta, W / 2, scoreY + 240)
  }

  // Sponsor slot
  if (sponsorName) {
    ctx.fillStyle = 'rgba(244,241,234,0.55)'
    ctx.font = '500 18px "Inter", sans-serif'
    ctx.fillText(`POWERED BY ${sponsorName.toUpperCase()}`, W / 2, H - 110)
  }

  bottomBrand(ctx, W, H)
  return await canvasToBlob(canvas)
}

/**
 * Portrait Card (1080×1350, solid).
 * Same content as Champion Card but in vertical aspect — perfect for WhatsApp preview.
 */
export async function renderPortraitCard(params) {
  await Promise.all([
    loadFont('Fraunces', 500), loadFont('Fraunces', 600), loadFont('Inter', 500),
  ])

  const W = 1080, H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H)

  const glow = ctx.createRadialGradient(W / 2, -40, 40, W / 2, -40, 800)
  glow.addColorStop(0, 'rgba(217,201,168,0.18)')
  glow.addColorStop(1, 'rgba(217,201,168,0.00)')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)

  ctx.textAlign = 'center'
  ctx.fillStyle = CHAMPAGNE
  ctx.font = '500 24px "Inter", sans-serif'
  ctx.fillText((params.award || 'CHAMPION').toUpperCase(), W / 2, 130)

  ctx.strokeStyle = HAIRLINE
  ctx.beginPath()
  ctx.moveTo(W / 2 - 80, 156); ctx.lineTo(W / 2 + 80, 156); ctx.stroke()

  ctx.fillStyle = BONE
  ctx.font = '500 96px "Fraunces", Georgia, serif'
  ctx.fillText(fitText(ctx, params.championName || '—', W - 120), W / 2, 320)

  ctx.fillStyle = 'rgba(244,241,234,0.78)'
  ctx.font = '500 30px "Inter", sans-serif'
  if (params.cupName) ctx.fillText(fitText(ctx, params.cupName, W - 160), W / 2, 380)

  ctx.fillStyle = 'rgba(244,241,234,0.55)'
  ctx.font = '500 22px "Inter", sans-serif'
  ctx.fillText((params.scoreLabel || 'FINAL SCORE').toUpperCase(), W / 2, 560)
  ctx.fillStyle = CHAMPAGNE
  ctx.font = '500 220px "Fraunces", Georgia, serif'
  ctx.fillText(String(params.score ?? '—'), W / 2, 770)

  const meta = [params.courseName, params.dateLabel].filter(Boolean).join('  ·  ')
  if (meta) {
    ctx.fillStyle = 'rgba(244,241,234,0.62)'
    ctx.font = '500 24px "Inter", sans-serif'
    ctx.fillText(meta, W / 2, 860)
  }

  if (params.sponsorName) {
    ctx.fillStyle = 'rgba(244,241,234,0.55)'
    ctx.font = '500 18px "Inter", sans-serif'
    ctx.fillText(`POWERED BY ${params.sponsorName.toUpperCase()}`, W / 2, H - 140)
  }

  bottomBrand(ctx, W, H)
  return await canvasToBlob(canvas)
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve({ blob, dataUrl: canvas.toDataURL('image/png') })
    }, 'image/png', 0.95)
  })
}

/** Share or download a generated PNG.
 *  Delegates to the shared `lib/shareImage` helper (single source of truth). */
export const shareCard = shareImageOrDownload
