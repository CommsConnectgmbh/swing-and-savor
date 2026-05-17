import { useState } from 'react'

export default function PasswordGate({ correctPassword, tournamentId, onSuccess, onCancel, viewMode = false }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (pw === correctPassword) {
      try { sessionStorage.setItem(`golf_unlocked_${tournamentId}`, '1') } catch {}
      onSuccess()
    } else {
      setError(true)
      setPw('')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/75 animate-fade-up"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-lg mx-auto rounded-t-2xl p-6 pb-10 bg-surface border-t border-x border-line shadow-lift">

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-lock/10 border border-lock/30">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5b94a"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <div>
            <p className="font-bold text-sm text-ink">{viewMode ? 'Tournament protected' : 'Write protection active'}</p>
            <p className="text-xs mt-0.5 text-inkDim">{viewMode ? 'Enter password to view data' : 'Enter password to edit'}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            autoFocus
            autoComplete="off"
            className={`w-full rounded-xl px-4 py-3 text-ink text-sm bg-bg border placeholder:text-inkDim transition-colors ${error ? 'border-danger' : 'border-line'}`}
            placeholder="Password"
            value={pw}
            onChange={e => { setPw(e.target.value); setError(false) }}
          />
          {error && (
            <p className="text-xs pl-1 text-danger">Wrong password</p>
          )}
          <div className="flex gap-2 mt-1">
            <button type="button" onClick={onCancel}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-bg text-inkDim border border-line active:scale-[0.98] transition-transform">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-accent text-brandDark active:scale-[0.98] transition-transform">
              Unlock
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
