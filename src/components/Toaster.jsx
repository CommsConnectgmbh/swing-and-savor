import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { onToast, dismissToast } from '../lib/toast'

export default function Toaster() {
  const navigate = useNavigate()
  const [toasts, setToasts] = useState([])

  useEffect(() => onToast((ev) => {
    if (ev.type === 'add') {
      setToasts(prev => [...prev, ev.toast])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== ev.toast.id)), ev.toast.ttlMs)
    } else if (ev.type === 'remove') {
      setToasts(prev => prev.filter(t => t.id !== ev.id))
    }
  }), [])

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] flex flex-col items-center gap-2"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}>
      {toasts.map(t => (
        <button key={t.id}
          onClick={() => {
            if (t.action) navigate(t.action)
            dismissToast(t.id)
          }}
          className="w-[92%] max-w-md flex items-start gap-3 px-4 py-3 rounded-2xl bg-surface border border-accent/40 shadow-lift active:scale-[0.99] transition-transform text-left animate-fade-up"
          style={{ animationDuration: '220ms' }}>
          {t.icon && <span className="text-xl leading-none flex-shrink-0">{t.icon}</span>}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-ink leading-tight truncate">{t.title}</p>
            {t.body && <p className="text-xs text-inkMuted leading-tight mt-0.5 truncate">{t.body}</p>}
          </div>
          <span className="text-[10px] text-inkDim flex-shrink-0 mt-0.5">×</span>
        </button>
      ))}
    </div>
  )
}
