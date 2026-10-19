import { describe, it, expect, vi, beforeEach } from 'vitest'

const init = vi.fn()
const close = vi.fn(() => Promise.resolve(true))
vi.mock('@sentry/react', () => ({ init, close, captureException: vi.fn() }))

function speicher() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
    clear: () => m.clear(),
  }
}

describe('Fehlerberichte nur nach Einwilligung', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', speicher())
    vi.resetModules()
    init.mockClear(); close.mockClear()
    localStorage.clear()
  })

  it('ohne Wahl wird Sentry nicht gestartet', async () => {
    await import('../sentry')
    expect(init).not.toHaveBeenCalled()
  })

  it('nach Ablehnen wird Sentry nicht gestartet', async () => {
    localStorage.setItem('sns_error_reports', 'denied')
    await import('../sentry')
    expect(init).not.toHaveBeenCalled()
  })

  it('mit gespeicherter Zustimmung startet Sentry ohne Tracing und ohne PII', async () => {
    localStorage.setItem('sns_error_reports', 'granted')
    await import('../sentry')
    expect(init).toHaveBeenCalledTimes(1)
    const opts = init.mock.calls[0][0]
    expect(opts.tracesSampleRate).toBe(0)
    expect(opts.sendDefaultPii).toBe(false)
    expect(opts.dsn).toContain('ingest.de.sentry.io')
  })

  it('Zustimmung im Banner startet, Widerruf stoppt Sentry', async () => {
    const s = await import('../sentry')
    const er = await import('./errorReports')
    er.setErrorReportChoice('granted')
    expect(init).toHaveBeenCalledTimes(1)
    expect(s.errorReportsActive()).toBe(true)
    er.resetErrorReportChoice()
    await Promise.resolve()
    expect(close).toHaveBeenCalledTimes(1)
    expect(s.errorReportsActive()).toBe(false)
    expect(er.getErrorReportChoice()).toBe(null)
    er.setErrorReportChoice('denied')
    expect(init).toHaveBeenCalledTimes(1)
  })

  it('ungueltige Werte werden abgelehnt bzw. als keine Wahl gelesen', async () => {
    const er = await import('./errorReports')
    expect(() => er.setErrorReportChoice('yes')).toThrow()
    localStorage.setItem('sns_error_reports', 'yes')
    expect(er.getErrorReportChoice()).toBe(null)
  })
})
