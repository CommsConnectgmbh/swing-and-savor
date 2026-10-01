import { describe, it, expect } from 'vitest'
import { isPermissionError, saveErrorToast, notifySaveFailed } from './saveErrors'

describe('saveErrors', () => {
  it('erkennt RLS-Fehler', () => {
    expect(isPermissionError({ code: '42501', message: '' })).toBe(true)
    expect(isPermissionError({ message: 'new row violates row-level security policy for table "hole_results"' })).toBe(true)
    expect(isPermissionError({ message: 'Failed to fetch' })).toBe(false)
    expect(isPermissionError(null)).toBe(false)
  })

  it('erklärt fehlende Rechte und Netzfehler unterschiedlich', () => {
    expect(saveErrorToast({ code: '42501' }).body).toMatch(/Spieler dieses Matches/)
    expect(saveErrorToast(null, { noRows: true }).body).toMatch(/Spieler dieses Matches/)
    expect(saveErrorToast({ message: 'Failed to fetch' }).body).toMatch(/Verbindung/)
  })

  it('drosselt wiederholte Meldungen', () => {
    expect(notifySaveFailed({ code: '42501' }, {}, 1_000_000)).toBe(true)
    expect(notifySaveFailed({ code: '42501' }, {}, 1_001_000)).toBe(false)
    expect(notifySaveFailed({ code: '42501' }, {}, 1_004_000)).toBe(true)
  })
})
