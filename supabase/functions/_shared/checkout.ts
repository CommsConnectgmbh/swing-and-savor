// Gemeinsame Konstruktion der Stripe-Checkout-Parameter fuer die Einmalzahlungen
// (Premium, Boost, Pro). Haelt die rechtlich relevante Basis an EINER getesteten
// Stelle: locale 'de' (§ 312j BGB: deutschsprachige Bestellseite) und
// submit_type 'pay' (eindeutiger Bestell-Button; bei mode 'payment' zulaessig).
// type-only Stripe-Import -> zur Laufzeit keine Abhaengigkeit, isoliert testbar.
import type Stripe from 'https://esm.sh/stripe@14?target=deno'

/** Eine Position der Einmalzahlung (price_data wird daraus gebaut). */
export interface ZahlungsPosten {
  name: string
  description: string
  /** Betrag in Cent. */
  unitAmount: number
}

export interface ZahlungsCheckout {
  posten: ZahlungsPosten
  metadata: Record<string, string>
  /** ISO-Zeitpunkt der serverseitig gepruefen Volljaehrigkeits-Bestaetigung (Pflicht). */
  volljaehrigBestaetigtAm: string
  successUrl: string
  cancelUrl: string
}

/**
 * Baut die Parameter fuer eine Einmalzahlung per Stripe Checkout. Die § 312j-
 * relevanten Felder (locale 'de', submit_type 'pay') und die technische Basis
 * (mode 'payment', Kartenzahlung, EUR-price_data, quantity 1) sind hier fest;
 * die Positionsdaten, Metadaten und Weiterleitungen gibt der jeweilige Aufruf.
 */
export function zahlungsCheckoutParams(c: ZahlungsCheckout): Stripe.Checkout.SessionCreateParams {
  if (!c.volljaehrigBestaetigtAm || Number.isNaN(Date.parse(c.volljaehrigBestaetigtAm))) {
    throw new Error('volljaehrigkeit_nicht_bestaetigt')
  }
  return {
    mode: 'payment',
    locale: 'de',
    submit_type: 'pay',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: { name: c.posten.name, description: c.posten.description },
        unit_amount: c.posten.unitAmount,
      },
      quantity: 1,
    }],
    metadata: {
      ...c.metadata,
      adult_confirmed: 'true',
      adult_confirmed_at: c.volljaehrigBestaetigtAm,
    },
    success_url: c.successUrl,
    cancel_url: c.cancelUrl,
  }
}

export type VolljaehrigkeitsPruefung =
  | { ok: true; bestaetigtAm: string }
  | { ok: false; error: 'adult_confirmation_required' }

/**
 * Kaeufe nur durch Volljaehrige: Der Client muss `adult_confirmed: true`
 * (Pflicht-Checkbox "Ich bin volljaehrig") mitsenden. Alles andere (fehlend,
 * "true" als String, 1 ...) wird abgelehnt. Der Zeitpunkt wird serverseitig
 * gesetzt und als Nachweis in Stripe-Metadaten und Kaufbeleg gespeichert.
 */
export function pruefeVolljaehrigkeit(body: unknown, jetzt: Date = new Date()): VolljaehrigkeitsPruefung {
  const b = (body && typeof body === 'object') ? body as Record<string, unknown> : {}
  if (b.adult_confirmed !== true) return { ok: false, error: 'adult_confirmation_required' }
  return { ok: true, bestaetigtAm: jetzt.toISOString() }
}
