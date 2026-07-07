import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import LanguageQuickSwitch from '../components/LanguageQuickSwitch'
import { callPublicFunction } from '../lib/functions'

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

    // Reviewer-Bypass: Code wird nicht per Mail versendet — Reviewer kennt
    // den Code aus den App-Review-Demo-Credentials. Direkt zum Code-Step.
    const lowered = email.toLowerCase().trim()
    if (lowered === 'apple-review@swingandsavor.at' ||
        lowered === 'play-review@swingandsavor.at') {
      setStep('code')
      return
    }

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

    const lowered = email.toLowerCase().trim()
    if (lowered === 'apple-review@swingandsavor.at' ||
        lowered === 'play-review@swingandsavor.at') {
      try {
        const { res, data } = await callPublicFunction('reviewer-bypass', {
          method: 'POST',
          body: { email: lowered, code: code.trim() },
        })
        if (res.ok) {
          const { token_hash } = data
          if (token_hash) {
            const { error: verifyErr } = await supabase.auth.verifyOtp({
              type: 'magiclink',
              token_hash,
            })
            setBusy(false)
            if (verifyErr) { setError(t('signIn.errorGeneric')); return }
            return
          }
        } else {
          setBusy(false)
          setError(t('signIn.errorGeneric'))
          return
        }
      } catch (err) {
        console.error('[auth] reviewer-bypass failed', err)
        setBusy(false)
        setError(t('signIn.errorGeneric'))
        return
      }
      setBusy(false)
      setError(t('signIn.errorGeneric'))
      return
    }

    const { error } = await supabase.auth.verifyOtp({
      email, token: code.trim(), type: 'email',
    })
    setBusy(false)
    if (error) { setError(t('signIn.errorGeneric')); return }
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg relative overflow-hidden">
      {/* Editorial backdrop: subtle vertical gradient */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(217,201,168,0.06), transparent 60%)',
        }}
      />
      <div className="absolute top-4 right-4 z-10"><LanguageQuickSwitch /></div>

      <div className="flex-1 flex flex-col justify-end px-7 pb-12 pt-24 relative">
        {/* Logo + Editorial label */}
        <div className="flex items-center gap-3 mb-6">
          <img
            src="/logo.png"
            alt="Swing & Savor"
            width="56"
            height="56"
            className="rounded-2xl flex-shrink-0"
            style={{ boxShadow: '0 0 0 1px rgba(217,201,168,0.22), 0 8px 24px rgba(0,0,0,0.55)' }}
          />
          <div className="flex flex-col leading-none">
            <span className="font-display text-ink text-[20px] tracking-tight" style={{ fontWeight: 600 }}>
              Swing<span style={{ color: '#D9C9A8' }}> &amp; </span>Savor
            </span>
            <span className="text-[10px] text-accent uppercase tracking-[0.42em] mt-1.5">
              The Clubhouse
            </span>
          </div>
        </div>

        {/* Hero headline */}
        <h1 className="font-display text-ink leading-[0.92] mb-4"
            style={{ fontSize: 'clamp(40px, 9vw, 56px)', fontWeight: 500, letterSpacing: '-0.02em' }}>
          {step === 'email'
            ? t('signIn.title')
            : t('signIn.enterCode')}
        </h1>

        <p className="font-sans text-inkMuted text-[15px] leading-relaxed max-w-[320px] mb-10">
          {step === 'email' ? t('signIn.subtitle') : t('signIn.codeSent')}
        </p>

        {step === 'email' ? (
          <form onSubmit={sendCode} className="flex flex-col gap-3">
            <input
              type="email" autoComplete="email" autoFocus inputMode="email"
              placeholder={t('signIn.emailPlaceholder')}
              className="w-full bg-transparent hairline-b border-0 px-1 py-3 text-ink placeholder:text-inkDim text-[16px] focus:outline-none transition-colors"
              style={{ borderRadius: 0 }}
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null) }}
            />
            {error && <p className="text-danger text-xs">{error}</p>}
            <button type="submit" disabled={busy}
              className="mt-4 py-4 text-[13px] font-medium tracking-[0.24em] uppercase bg-accent text-bg active:scale-[0.98] transition-transform disabled:opacity-50">
              {busy ? t('signIn.sending') : t('signIn.sendCode')}
            </button>

            <p className="text-[11px] text-inkDim text-center mt-3 leading-relaxed">
              {t('signIn.legalPrefix')} <span className="underline-offset-2">{t('signIn.legalTerms')}</span> {t('signIn.legalAnd')} <span className="underline-offset-2">{t('signIn.legalPrivacy')}</span>.
            </p>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="flex flex-col gap-3">
            <input
              type="text" inputMode="numeric" pattern="[0-9]*" autoFocus
              maxLength={8}
              placeholder="– – – – – – – –"
              className="w-full bg-transparent hairline-b border-0 px-1 py-4 text-ink placeholder:text-inkDim text-center font-display font-medium text-[28px] tracking-[0.32em] tabular-nums focus:outline-none transition-colors"
              style={{ borderRadius: 0 }}
              value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError(null) }}
            />
            {error && <p className="text-danger text-xs text-center">{error}</p>}
            <button type="submit" disabled={busy}
              className="mt-4 py-4 text-[13px] font-medium tracking-[0.24em] uppercase bg-accent text-bg active:scale-[0.98] transition-transform disabled:opacity-50">
              {busy ? t('signIn.verifying') : t('signIn.verify')}
            </button>
            <button type="button" onClick={() => { setStep('email'); setCode(''); setError(null) }}
              className="text-[11px] text-inkMuted py-3 tracking-[0.24em] uppercase hover:text-accent transition-colors">
              ← {t('signIn.email')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
