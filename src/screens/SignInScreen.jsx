import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function SignInScreen() {
  const [step, setStep] = useState('email') // 'email' | 'code'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function sendCode(e) {
    e.preventDefault()
    if (!email || !email.includes('@')) { setError('Bitte gültige Email eingeben'); return }
    setBusy(true); setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    setBusy(false)
    if (error) { setError(error.message); return }
    setStep('code')
  }

  async function verifyCode(e) {
    e.preventDefault()
    if (!code || code.length !== 8) { setError('Code ist 8 Stellen'); return }
    setBusy(true); setError(null)
    const { error } = await supabase.auth.verifyOtp({
      email, token: code.trim(), type: 'email',
    })
    setBusy(false)
    if (error) { setError('Code falsch oder abgelaufen'); return }
    // AuthProvider listens to authStateChange and refreshes user/profile
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 animate-fade-up bg-bg">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <img src="/logo.png" alt="Swing & Savor" width="80" height="80" className="rounded-2xl mb-4" />
          <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-accent">Swing &amp; Savor</p>
          <p className="text-inkMuted text-sm mt-2 max-w-[260px]">
            {step === 'email'
              ? 'Melde dich an, um Turniere zu spielen und Freunde einzuladen.'
              : `Wir haben einen Code an ${email} geschickt.`}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={sendCode} className="flex flex-col gap-3">
            <input
              type="email" autoComplete="email" autoFocus inputMode="email"
              placeholder="deine@email.de"
              className="w-full bg-surface border border-line rounded-xl px-4 py-3.5 text-ink placeholder:text-inkDim text-sm focus:border-accent/60 transition-colors"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null) }}
            />
            {error && <p className="text-danger text-xs pl-1">{error}</p>}
            <button type="submit" disabled={busy}
              className="py-3.5 rounded-xl text-sm font-bold tracking-wide bg-accent text-brandDark active:scale-[0.98] transition-transform disabled:opacity-50">
              {busy ? 'Sende Code…' : 'Code senden'}
            </button>
            <p className="text-[11px] text-inkDim text-center mt-1 leading-relaxed">
              Wir schicken dir einen Anmelde-Code per Email. Kein Passwort nötig.
            </p>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="flex flex-col gap-3">
            <input
              type="text" inputMode="numeric" pattern="[0-9]*" autoFocus
              maxLength={8}
              placeholder="– – – – – – – –"
              className="w-full bg-surface border border-line rounded-xl px-4 py-4 text-ink placeholder:text-inkDim text-center font-condensed font-black text-2xl tracking-[0.4em] tabular-nums focus:border-accent/60 transition-colors"
              value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError(null) }}
            />
            {error && <p className="text-danger text-xs pl-1 text-center">{error}</p>}
            <button type="submit" disabled={busy}
              className="py-3.5 rounded-xl text-sm font-bold tracking-wide bg-accent text-brandDark active:scale-[0.98] transition-transform disabled:opacity-50">
              {busy ? 'Prüfe…' : 'Anmelden'}
            </button>
            <button type="button" onClick={() => { setStep('email'); setCode(''); setError(null) }}
              className="text-xs text-inkMuted py-2 hover:text-ink transition-colors">
              ← Email ändern
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
