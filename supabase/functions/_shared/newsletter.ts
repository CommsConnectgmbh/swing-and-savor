// Abmeldung vom Newsletter (Art. 7 Abs. 3 DSGVO, § 7 UWG, RFC 8058).
// Jede Newsletter-Mail MUSS ueber newsletterNachricht() gebaut werden: sie setzt
// den Abmeldelink im Text sowie die Header List-Unsubscribe und
// List-Unsubscribe-Post (One-Click). Ohne gueltiges Abmelde-Token wird kein
// Versand-Payload erzeugt.
// Als Token dient das zufaellige 192-bit-Token des Abonnenten (confirm_token).

export const SITE = 'https://swingandsavor.at'
export const ABMELDE_MAILTO = 'hi@swingandsavor.at'
const TOKEN_RE = /^[0-9a-f]{48}$/

export function istGueltigesToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_RE.test(token)
}

/** One-Click-Endpunkt (POST) fuer den List-Unsubscribe-Header. */
export function abmeldeEndpunkt(supabaseUrl: string, token: string): string {
  if (!istGueltigesToken(token)) throw new Error('ungueltiges_abmelde_token')
  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/subscribe-newsletter?unsubscribe=${token}`
}

/** Abmeldeseite fuer den Link im Mailtext (mit Bestaetigungs-Knopf). */
export function abmeldeSeite(token: string): string {
  if (!istGueltigesToken(token)) throw new Error('ungueltiges_abmelde_token')
  return `${SITE}/abmelden?t=${token}`
}

export function abmeldeHeader(supabaseUrl: string, token: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${abmeldeEndpunkt(supabaseUrl, token)}>, <mailto:${ABMELDE_MAILTO}?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}

const FUSS: Record<string, (link: string) => string> = {
  de: (l) => `Du erhältst diese E-Mail, weil du den Swing &amp; Savor Newsletter bestätigt hast. <a href="${l}">Newsletter abbestellen</a>.`,
  en: (l) => `You receive this email because you confirmed the Swing &amp; Savor newsletter. <a href="${l}">Unsubscribe</a>.`,
  es: (l) => `Recibes este email porque confirmaste el newsletter de Swing &amp; Savor. <a href="${l}">Darse de baja</a>.`,
  fr: (l) => `Tu reçois cet e-mail car tu as confirmé la newsletter Swing &amp; Savor. <a href="${l}">Se désabonner</a>.`,
  ja: (l) => `Swing &amp; Savor ニュースレターの登録を確認されたため、このメールをお送りしています。<a href="${l}">配信停止</a>`,
}

export interface NewsletterEingabe {
  supabaseUrl: string
  from: string
  replyTo: string
  to: string
  token: string
  lang?: string
  subject: string
  html: string
}

/** Resend-Payload fuer genau einen Empfaenger, mit Abmeldelink und -Headern. */
export function newsletterNachricht(e: NewsletterEingabe) {
  if (!istGueltigesToken(e.token)) throw new Error('ungueltiges_abmelde_token')
  const fuss = (FUSS[(e.lang || 'en').slice(0, 2)] || FUSS.en)(abmeldeSeite(e.token))
  return {
    from: e.from,
    to: [e.to],
    reply_to: e.replyTo,
    subject: e.subject,
    html: `${e.html}<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px"/><p style="color:#6b7280;font-size:12px;line-height:1.5;">${fuss}<br/>Comms Connect GmbH, Tal 30, 80331 München</p>`,
    headers: abmeldeHeader(e.supabaseUrl, e.token),
  }
}

export type AbmeldeAktion =
  | { art: 'seite'; ziel: string }       // GET aus dem Mailtext -> Abmeldeseite
  | { art: 'abmelden'; token: string }    // POST (One-Click oder Knopf der Abmeldeseite)
  | { art: 'ungueltig' }
  | null                                  // keine Abmelde-Anfrage

/** Ordnet eine Anfrage an subscribe-newsletter einer Abmelde-Aktion zu. */
export function abmeldeAktion(method: string, url: URL): AbmeldeAktion {
  if (!url.searchParams.has('unsubscribe')) return null
  const token = url.searchParams.get('unsubscribe')
  if (!istGueltigesToken(token)) return { art: 'ungueltig' }
  if (method === 'POST') return { art: 'abmelden', token }
  if (method === 'GET') return { art: 'seite', ziel: abmeldeSeite(token) }
  return { art: 'ungueltig' }
}
