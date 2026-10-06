import { useTranslation } from 'react-i18next'

// Diskreter, dauerhafter Zugang zu Impressum/Datenschutz/AGB.
// Die Rechtstexte liegen auf der Marketing-Site (swingandsavor.at),
// deshalb absolute Links. Reicht über den Remote-Load auch in die
// Capacitor-Store-Apps, ohne Store-Rebuild.
export default function LegalFooter({ className = '' }) {
  const { t } = useTranslation()
  const link = 'text-[11px] text-inkDim hover:text-inkMuted underline underline-offset-2 transition-colors'
  return (
    <footer className={`flex items-center justify-center gap-2 text-inkDim ${className}`}>
      <a href="https://swingandsavor.at/impressum" target="_blank" rel="noopener" className={link}>
        {t('profile.impressum')}
      </a>
      <span aria-hidden="true">·</span>
      <a href="https://swingandsavor.at/datenschutz" target="_blank" rel="noopener" className={link}>
        {t('profile.datenschutz')}
      </a>
      <span aria-hidden="true">·</span>
      <a href="https://swingandsavor.at/agb" target="_blank" rel="noopener" className={link}>
        {t('profile.agb')}
      </a>
    </footer>
  )
}
