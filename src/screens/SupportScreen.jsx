import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import SupportCenter from '../components/support/SupportCenter'

export default function SupportScreen() {
  const navigate = useNavigate()
  return (
    <div className="min-h-dvh bg-bg pb-24">
      <div className="flex items-center gap-3 px-3 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Zurück"
          className="w-10 h-10 rounded-full bg-surface border border-line flex items-center justify-center active:scale-95 transition-transform"
        >
          ‹
        </button>
        <h1 className="text-xl font-bold">Hilfe &amp; Support</h1>
      </div>
      <div className="px-3 pt-2">
        <SupportCenter
          supabase={supabase}
          appLabel="Swing & Savor"
          brandColor="#0ea5a4"
          context={{ platform: 'web', app: 'swingandsavor' }}
        />
      </div>
    </div>
  )
}
