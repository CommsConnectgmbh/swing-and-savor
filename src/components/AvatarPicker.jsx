import { useRef, useState } from 'react'
import { uploadAvatar } from '../lib/avatar'

export default function AvatarPicker({ userId, value, fallback = '?', onChange, size = 96 }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null); setBusy(true); setStatus('Lade hoch…')
    try {
      const url = await uploadAvatar(userId, file)
      setStatus('Fertig')
      onChange?.(url)
      setTimeout(() => setStatus(null), 1200)
    } catch (err) {
      console.error('[AvatarPicker]', err)
      setError(err?.message || err?.error?.message || 'Upload fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="relative rounded-full overflow-hidden bg-accent/15 border-2 border-accent/40 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-60"
        style={{ width: size, height: size }}
      >
        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="font-condensed font-black text-3xl text-accent">
            {fallback?.[0]?.toUpperCase() ?? '?'}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-brandDark/85 text-[9px] font-bold tracking-[0.18em] uppercase text-accent py-1 text-center">
          {busy ? (status || '…') : value ? 'Ändern' : '+ Bild'}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={pick}
      />
      {error && <p className="text-xs text-danger break-words max-w-[200px] text-center">{error}</p>}
    </div>
  )
}
