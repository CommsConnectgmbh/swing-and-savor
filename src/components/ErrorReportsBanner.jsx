import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getErrorReportChoice, setErrorReportChoice, ERROR_REPORTS_EVENT } from '../lib/errorReports'

// Schlanke Einwilligungsabfrage nur fuer Fehlerberichte (Sentry).
// "Ablehnen" und "Erlauben" sind gleichwertig gestaltet.
export default function ErrorReportsBanner() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(() => getErrorReportChoice() === null)

  useEffect(() => {
    const onChange = () => setOpen(getErrorReportChoice() === null)
    window.addEventListener(ERROR_REPORTS_EVENT, onChange)
    return () => window.removeEventListener(ERROR_REPORTS_EVENT, onChange)
  }, [])

  if (!open) return null
  const btn = 'flex-1 py-3 rounded-xl text-sm font-bold bg-bg text-ink border border-line active:scale-[0.98] transition-transform'
  return (
    <div role="dialog" aria-labelledby="sns-er-title" aria-describedby="sns-er-text"
      className="fixed inset-x-0 bottom-0 z-[80] px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      <div className="mx-auto max-w-lg bg-surface border border-line rounded-2xl p-4 space-y-3 shadow-2xl">
        <p id="sns-er-title" className="text-sm font-bold text-ink">{t('errorReports.title')}</p>
        <p id="sns-er-text" className="text-[12px] leading-relaxed text-inkMuted">
          {t('errorReports.text')}{' '}
          <a href="https://swingandsavor.at/datenschutz#sentry" target="_blank" rel="noopener"
            className="underline underline-offset-2">{t('errorReports.more')}</a>
        </p>
        <div className="flex gap-2">
          <button type="button" className={btn} onClick={() => setErrorReportChoice('denied')}>
            {t('errorReports.decline')}
          </button>
          <button type="button" className={btn} onClick={() => setErrorReportChoice('granted')}>
            {t('errorReports.accept')}
          </button>
        </div>
      </div>
    </div>
  )
}
