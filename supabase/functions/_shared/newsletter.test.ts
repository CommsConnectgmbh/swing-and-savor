import { describe, it, expect } from 'vitest'
import { newsletterNachricht, abmeldeAktion, abmeldeHeader, istGueltigesToken } from './newsletter.ts'

const TOKEN = 'a'.repeat(24) + '0123456789abcdef01234567'
const SB = 'https://rcqichlyllhwougopfkg.supabase.co'

describe('Newsletter-Abmeldung', () => {
  it('Token-Format: nur 48 Hex-Zeichen', () => {
    expect(istGueltigesToken(TOKEN)).toBe(true)
    for (const t of ['', 'abc', TOKEN.toUpperCase(), TOKEN + 'a', TOKEN.slice(1) + 'g', null, undefined, 42]) {
      expect(istGueltigesToken(t)).toBe(false)
    }
  })

  it('Header nach RFC 8058 (One-Click) plus mailto', () => {
    expect(abmeldeHeader(SB, TOKEN)).toEqual({
      'List-Unsubscribe': `<${SB}/functions/v1/subscribe-newsletter?unsubscribe=${TOKEN}>, <mailto:hi@swingandsavor.at?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
  })

  it('jede Newsletter-Mail hat Abmeldelink im Text und die Header', () => {
    const m = newsletterNachricht({ supabaseUrl: SB + '/', from: 'S <hi@swingandsavor.at>', replyTo: 'hi@swingandsavor.at', to: 'x@example.org', token: TOKEN, lang: 'de', subject: 'News', html: '<p>Hallo</p>' })
    expect(m.to).toEqual(['x@example.org'])
    expect(m.html).toContain(`https://swingandsavor.at/abmelden?t=${TOKEN}`)
    expect(m.html).toContain('Newsletter abbestellen')
    expect(m.headers['List-Unsubscribe']).toContain(`${SB}/functions/v1/subscribe-newsletter?unsubscribe=${TOKEN}`)
    expect(m.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('unbekannte Sprache faellt auf Englisch zurueck', () => {
    const m = newsletterNachricht({ supabaseUrl: SB, from: 'f', replyTo: 'r', to: 't@example.org', token: TOKEN, lang: 'xx', subject: 's', html: '' })
    expect(m.html).toContain('Unsubscribe')
  })

  it('ohne gueltiges Token kein Versand-Payload', () => {
    expect(() => newsletterNachricht({ supabaseUrl: SB, from: 'f', replyTo: 'r', to: 't@example.org', token: '', subject: 's', html: '' })).toThrow('ungueltiges_abmelde_token')
  })

  it('Anfragen werden richtig zugeordnet', () => {
    const u = (q: string) => new URL(`${SB}/functions/v1/subscribe-newsletter${q}`)
    expect(abmeldeAktion('POST', u(''))).toBeNull()
    expect(abmeldeAktion('GET', u('?confirm=abc'))).toBeNull()
    expect(abmeldeAktion('POST', u(`?unsubscribe=${TOKEN}`))).toEqual({ art: 'abmelden', token: TOKEN })
    expect(abmeldeAktion('GET', u(`?unsubscribe=${TOKEN}`))).toEqual({ art: 'seite', ziel: `https://swingandsavor.at/abmelden?t=${TOKEN}` })
    expect(abmeldeAktion('POST', u('?unsubscribe=xyz'))).toEqual({ art: 'ungueltig' })
    expect(abmeldeAktion('DELETE', u(`?unsubscribe=${TOKEN}`))).toEqual({ art: 'ungueltig' })
  })
})
