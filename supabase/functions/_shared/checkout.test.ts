import { describe, it, expect } from 'vitest'
import { zahlungsCheckoutParams, pruefeVolljaehrigkeit } from './checkout.ts'

const AM = '2026-10-19T10:00:00.000Z'

// Belegt die drei geaenderten Checkout-Aufrufpfade (Premium, Boost, Pro). Alle
// bauen ihre an stripe.checkout.sessions.create uebergebenen Parameter ueber
// zahlungsCheckoutParams; hier werden die § 312j-relevanten Felder und die
// korrekte Weitergabe der positionsspezifischen Daten geprueft.

const erwartet312j = (p: ReturnType<typeof zahlungsCheckoutParams>) => {
  expect(p.mode).toBe('payment')
  expect(p.locale).toBe('de')          // § 312j: deutschsprachige Bestellseite
  expect(p.submit_type).toBe('pay')    // eindeutiger Bestell-Button (bei payment zulaessig)
  expect(p.payment_method_types).toEqual(['card'])
  const li = (p.line_items as any[])[0]
  expect(li.price_data.currency).toBe('eur')
  expect(li.quantity).toBe(1)
}

describe('zahlungsCheckoutParams – § 312j-Basis an allen drei Checkouts', () => {
  it('Premium (create-premium-checkout)', () => {
    const p = zahlungsCheckoutParams({
      posten: { name: 'Premium — Sommer Cup', description: 'One-time upgrade. Premium Eventpage, Winner Cards, Recap, Branding light.', unitAmount: 4900 },
      metadata: { tournament_id: 't1', package_type: 'premium', buyer_profile_id: 'u1', app: 'swing-and-savor' },
      successUrl: 'https://app.swingandsavor.at/cup?upgrade=success&cup=ABC',
      cancelUrl: 'https://app.swingandsavor.at/cup?upgrade=cancel',
      volljaehrigBestaetigtAm: AM,
    })
    erwartet312j(p)
    const li = (p.line_items as any[])[0]
    expect(li.price_data.unit_amount).toBe(4900)
    expect(li.price_data.product_data.name).toBe('Premium — Sommer Cup')
    expect(p.metadata).toEqual({ tournament_id: 't1', package_type: 'premium', buyer_profile_id: 'u1', app: 'swing-and-savor', adult_confirmed: 'true', adult_confirmed_at: AM })
    expect(p.success_url).toBe('https://app.swingandsavor.at/cup?upgrade=success&cup=ABC')
    expect(p.cancel_url).toBe('https://app.swingandsavor.at/cup?upgrade=cancel')
    expect('subscription_data' in p).toBe(false) // Einmalzahlung, kein Abo
  })

  it('Boost (create-boost-checkout)', () => {
    const p = zahlungsCheckoutParams({
      posten: { name: 'Boost (7 Tage) — Sommer Cup', description: 'Mehr Sichtbarkeit', unitAmount: 999 },
      metadata: { app: 'swing-and-savor', purpose: 'boost', tournament_id: 't1', tier: 'gold', duration_days: '7', buyer_profile_id: 'u1' },
      successUrl: 'https://app.swingandsavor.at/cup?boost=success&cup=ABC',
      cancelUrl: 'https://app.swingandsavor.at/cup?boost=cancel',
      volljaehrigBestaetigtAm: AM,
    })
    erwartet312j(p)
    const li = (p.line_items as any[])[0]
    expect(li.price_data.unit_amount).toBe(999)
    expect(p.metadata).toMatchObject({ purpose: 'boost', duration_days: '7', tier: 'gold' })
    expect(p.success_url).toContain('boost=success')
  })

  it('Pro (create-pro-checkout)', () => {
    const p = zahlungsCheckoutParams({
      posten: { name: 'Pro Launch Monitor', description: 'One-time unlock. AR launch monitor …', unitAmount: 2999 },
      metadata: { buyer_profile_id: 'u1', product: 'launch_monitor', plan: 'pro', app: 'swing-and-savor' },
      successUrl: 'https://app.swingandsavor.at/range?pro=success',
      cancelUrl: 'https://app.swingandsavor.at/range?pro=cancel',
      volljaehrigBestaetigtAm: AM,
    })
    erwartet312j(p)
    const li = (p.line_items as any[])[0]
    expect(li.price_data.unit_amount).toBe(2999)
    expect(p.metadata).toMatchObject({ product: 'launch_monitor', plan: 'pro' })
    expect(p.success_url).toBe('https://app.swingandsavor.at/range?pro=success')
    expect(p.cancel_url).toBe('https://app.swingandsavor.at/range?pro=cancel')
  })
})

describe('Volljaehrigkeit – Pflicht vor jedem Kauf', () => {
  it('akzeptiert nur adult_confirmed === true und setzt den Zeitpunkt serverseitig', () => {
    const jetzt = new Date('2026-10-19T12:34:56.000Z')
    expect(pruefeVolljaehrigkeit({ adult_confirmed: true }, jetzt)).toEqual({ ok: true, bestaetigtAm: '2026-10-19T12:34:56.000Z' })
  })
  it.each([undefined, null, {}, { adult_confirmed: false }, { adult_confirmed: 'true' }, { adult_confirmed: 1 }, 'x'])(
    'lehnt %j ab', (body) => {
      expect(pruefeVolljaehrigkeit(body)).toEqual({ ok: false, error: 'adult_confirmation_required' })
    })
  it('Builder verweigert Checkout ohne Bestaetigung', () => {
    const basis = {
      posten: { name: 'X', description: 'Y', unitAmount: 100 },
      metadata: { app: 'swing-and-savor' },
      successUrl: 'https://a', cancelUrl: 'https://b',
    }
    expect(() => zahlungsCheckoutParams({ ...basis, volljaehrigBestaetigtAm: '' })).toThrow('volljaehrigkeit_nicht_bestaetigt')
    expect(() => zahlungsCheckoutParams({ ...basis, volljaehrigBestaetigtAm: 'kein-datum' })).toThrow('volljaehrigkeit_nicht_bestaetigt')
    expect(() => zahlungsCheckoutParams({ ...basis } as any)).toThrow('volljaehrigkeit_nicht_bestaetigt')
  })
  it('Metadaten des Aufrufers koennen den Nachweis nicht ueberschreiben', () => {
    const p = zahlungsCheckoutParams({
      posten: { name: 'X', description: 'Y', unitAmount: 100 },
      metadata: { adult_confirmed: 'false', adult_confirmed_at: 'fake' },
      successUrl: 'https://a', cancelUrl: 'https://b', volljaehrigBestaetigtAm: AM,
    })
    expect(p.metadata).toMatchObject({ adult_confirmed: 'true', adult_confirmed_at: AM })
  })
})
