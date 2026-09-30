// Full-screen "this tournament is password protected" placeholder.
//
// Previously duplicated verbatim inside MatchesScreen and TeamsScreen; the
// only per-screen difference was the subtitle copy, which is now passed in
// via `subtitle` so the extracted component renders identically to before.

export default function LockPlaceholder({ onUnlock, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 gap-4 animate-fade-up">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-lock/10 border border-lock/30">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f5b94a"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      </div>
      <div className="text-center">
        <p className="font-bold text-sm text-ink">Turnier geschützt</p>
        <p className="text-xs mt-1 text-inkMuted">{subtitle}</p>
      </div>
      <button onClick={onUnlock}
        className="px-6 py-2.5 rounded-xl text-sm font-bold bg-accent text-brandDark active:scale-[0.98] transition-transform">
        Passwort eingeben
      </button>
    </div>
  )
}
