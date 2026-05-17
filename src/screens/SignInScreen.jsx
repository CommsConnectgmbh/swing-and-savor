import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import LanguageQuickSwitch from '../components/LanguageQuickSwitch'

export default function SignInScreen() {
  const { t } = useTranslation()
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function sendCode(e) {
    e.preventDefault()
    if (!email || !email.includes('@')) { setError(t('signIn.errorGeneric')); return }
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
    if (!code || code.length !== 8) { setError(t('signIn.errorGeneric')); return }
    setBusy(true); setError(null)
    const { error } = await supabase.auth.verifyOtp({
      email, token: code.trim(), type: 'email',
    })
    setBusy(false)
    if (error) { setError(t('signIn.errorGeneric')); return }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 animate-fade-up bg-bg relative">
      <div className="absolute top-4 right-4"><LanguageQuickSwitch /></div>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <img src="/logo.png" alt="Swing & Savor" width="80" height="80" className="rounded-2xl mb-4" />
          <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-accent">{t('app.name')}</p>
          <p className="text-inkMuted text-sm mt-2 max-w-[260px]">
            {step === 'email' ? t('signIn.subtitle') : t('signIn.codeSent')}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={sendCode} className="flex flex-col gap-3">
            <input
              type="email" autoComplete="email" autoFocus inputMode="email"
              placeholder={t('signIn.emailPlaceholder')}
              className="w-full bg-surface border border-line rounded-xl px-4 py-3.5 text-ink placeholder:text-inkDim text-sm focus:border-accent/60 transition-colors"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null) }}
            />
            {error && <p className="text-danger text-xs pl-1">{error}</p>}
            <button type="submit" disabled={busy}
              className="py-3.5 rounded-xl text-sm font-bold tracking-wide bg-accent text-brandDark active:scale-[0.98] transition-transform disabled:opacity-50">
              {busy ? t('signIn.sending') : t('signIn.sendCode')}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="flex flex-col gap-3">
            <p className="text-xs text-inkMuted text-center">{t('signIn.enterCode')}</p>
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
              {busy ? t('signIn.verifying') : t('signIn.verify')}
            </button>
            <button type="button" onClick={() => { setStep('email'); setCode(''); setError(null) }}
              className="text-xs text-inkMuted py-2 hover:text-ink transition-colors">
              ← {t('signIn.email')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
