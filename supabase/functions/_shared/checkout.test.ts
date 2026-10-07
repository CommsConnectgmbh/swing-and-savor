import { describe, it, expect } from 'vitest'
import { zahlungsCheckoutParams } from './checkout.ts'

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
    })
    erwartet312j(p)
    const li = (p.line_items as any[])[0]
    expect(li.price_data.unit_amount).toBe(4900)
    expect(li.price_data.product_data.name).toBe('Premium — Sommer Cup')
    expect(p.metadata).toEqual({ tournament_id: 't1', package_type: 'premium', buyer_profile_id: 'u1', app: 'swing-and-savor' })
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
    })
    erwartet312j(p)
    const li = (p.line_items as any[])[0]
    expect(li.price_data.unit_amount).toBe(2999)
    expect(p.metadata).toMatchObject({ product: 'launch_monitor', plan: 'pro' })
    expect(p.success_url).toBe('https://app.swingandsavor.at/range?pro=success')
    expect(p.cancel_url).toBe('https://app.swingandsavor.at/range?pro=cancel')
  })
})
