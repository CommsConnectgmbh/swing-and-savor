import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { formatCupDate } from '../lib/format'
import { roundRect, loadImage } from '../lib/canvas'

/**
 * Editorial QR-Code-Sheet.
 *
 * Generates an SVG QR-code for the Invitational-Link with:
 *  - Champagne foreground, dark forest background
 *  - Logo (rendered as a separate overlay on top of the QR, masked so the QR still scans)
 *  - Premium "Tischaufsteller"-Layout: Cup name, date, course as caption
 *
 * Download as PNG (1080×1440, print-friendly) or share via Web-Share-API.
 */
export default function QrCodeSheet({ open, onClose, cup }) {
  const canvasRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [dataUrl, setDataUrl] = useState('')

  const inviteUrl = cup ? `https://swingandsavor.at/i/${cup.invite_code}` : ''

  useEffect(() => {
    if (!open || !cup) return
    renderPoster()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cup?.invite_code])

  async function renderPoster() {
    setBusy(true)
    const W = 1080, H = 1440
    const canvas = canvasRef.current || document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')

    // Background — Forest with subtle Champagne radial glow top
    ctx.fillStyle = '#0A1A12'; ctx.fillRect(0, 0, W, H)
    const grad = ctx.createRadialGradient(W / 2, -60, 60, W / 2, -60, 800)
    grad.addColorStop(0, 'rgba(217,201,168,0.12)')
    grad.addColorStop(1, 'rgba(217,201,168,0.00)')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)

    // Top eyebrow
    ctx.textAlign = 'center'
    ctx.fillStyle = '#D9C9A8'
    ctx.font = '500 26px "Inter", sans-serif'
    ctx.fillText("YOU'RE INVITED", W / 2, 130)

    // Hairline rule
    ctx.strokeStyle = 'rgba(217,201,168,0.45)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(W / 2 - 70, 150); ctx.lineTo(W / 2 + 70, 150); ctx.stroke()

    // Cup name — Fraunces display
    ctx.fillStyle = '#F4F1EA'
    ctx.font = '500 64px "Fraunces", Georgia, serif'
    wrapText(ctx, cup.name || 'Founder Invitational', W / 2, 230, W - 160, 76)

    // Meta line (date · location)
    ctx.fillStyle = 'rgba(244,241,234,0.72)'
    ctx.font = '500 24px "Inter", sans-serif'
    const dateStr = formatCupDate(cup.date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
    const meta = [dateStr, cup.location_name].filter(Boolean).join('  ·  ')
    if (meta) ctx.fillText(meta, W / 2, 380)

    // ── QR Code ──
    const qrSize = 720
    const qrX = (W - qrSize) / 2
    const qrY = 460
    // Champagne tile (rounded)
    roundRect(ctx, qrX - 28, qrY - 28, qrSize + 56, qrSize + 56, 24)
    ctx.fillStyle = '#F4F1EA'; ctx.fill()

    // Render QR onto a temp canvas then drawImage
    const tmp = document.createElement('canvas')
    tmp.width = qrSize; tmp.height = qrSize
    await QRCode.toCanvas(tmp, inviteUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: qrSize,
      color: { dark: '#0A1A12', light: '#F4F1EA' },
    })
    ctx.drawImage(tmp, qrX, qrY, qrSize, qrSize)

    // Logo overlay in center (high-error-correction lets us cover ~30% area)
    try {
      const logo = await loadImage('/logo.png')
      const lSize = 160
      const lx = (W - lSize) / 2
      const ly = qrY + (qrSize - lSize) / 2
      // White rounded backdrop
      roundRect(ctx, lx - 12, ly - 12, lSize + 24, lSize + 24, 24)
      ctx.fillStyle = '#F4F1EA'; ctx.fill()
      // Inner dark rounded for contrast with logo
      roundRect(ctx, lx, ly, lSize, lSize, 18)
      ctx.fillStyle = '#0A1A12'; ctx.fill()
      ctx.save()
      roundRect(ctx, lx, ly, lSize, lSize, 18); ctx.clip()
      ctx.drawImage(logo, lx, ly, lSize, lSize)
      ctx.restore()
    } catch (_) { /* logo missing — leave QR as-is, still scannable */ }

    // Bottom CTA caption
    ctx.fillStyle = 'rgba(244,241,234,0.62)'
    ctx.font = '500 22px "Inter", sans-serif'
    ctx.fillText('Scan to join the Invitational', W / 2, qrY + qrSize + 90)

    // S·S brand monogram
    ctx.fillStyle = '#D9C9A8'
    ctx.font = '600 36px "Fraunces", Georgia, serif'
    ctx.fillText('Swing  ·  Savor', W / 2, qrY + qrSize + 150)

    // Hairline footer
    ctx.strokeStyle = 'rgba(244,241,234,0.12)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(120, H - 80); ctx.lineTo(W - 120, H - 80); ctx.stroke()
    ctx.fillStyle = 'rgba(244,241,234,0.45)'
    ctx.font = '500 18px "Inter", sans-serif'
    ctx.fillText('swingandsavor.at', W / 2, H - 50)

    setDataUrl(canvas.toDataURL('image/png'))
    setBusy(false)
  }

  async function downloadPng() {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `swingsavor-qr-${cup.invite_code}.png`
    document.body.appendChild(a); a.click(); a.remove()
  }

  async function shareNative() {
    if (!dataUrl) return
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], `swingsavor-qr-${cup.invite_code}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: cup.name, text: 'Scan to join', url: inviteUrl })
        return
      }
    } catch (_) { /* fall through */ }
    downloadPng()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-up"
         onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
           className="w-full sm:max-w-md bg-bg hairline-t sm:hairline sm:rounded-card rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">

        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted">QR Tischaufsteller</p>
          <button onClick={onClose} className="text-inkMuted text-2xl leading-none p-1" aria-label="Close">×</button>
        </div>

        <div className="relative w-full hairline overflow-hidden bg-bg" style={{ aspectRatio: '3 / 4', maxWidth: 340, margin: '0 auto' }}>
          {dataUrl ? (
            <img src={dataUrl} alt="QR Poster" className="w-full h-full object-contain" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-inkDim text-xs tracking-[0.2em] uppercase">
              {busy ? 'Rendering…' : '—'}
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

        <p className="text-[11px] text-inkMuted text-center mt-4 leading-relaxed">
          1080×1440 PNG · druckbar als A4-Tischaufsteller oder iPad-Standee
        </p>

        <div className="flex gap-2 mt-5">
          <button onClick={shareNative} disabled={!dataUrl || busy}
            className="flex-1 py-4 bg-accent text-brandDark text-[12px] font-medium tracking-[0.28em] uppercase active:scale-[0.99] transition-transform disabled:opacity-50">
            Share
          </button>
          <button onClick={downloadPng} disabled={!dataUrl || busy}
            className="flex-1 py-4 hairline text-ink text-[12px] font-medium tracking-[0.28em] uppercase active:scale-[0.99] transition-transform disabled:opacity-50">
            Download
          </button>
        </div>
      </div>
    </div>
  )
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(/\s+/)
  let line = ''
  let yOff = y
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yOff)
      yOff += lineHeight
      line = w
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, yOff)
}
