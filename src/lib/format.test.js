import { describe, it, expect, vi, afterEach } from 'vitest'
import { relTime, fmtPts, formatCupDate } from './format'

describe('relTime', () => {
  afterEach(() => vi.useRealTimers())

  it('returns empty string for falsy input', () => {
    expect(relTime(null)).toBe('')
    expect(relTime('')).toBe('')
  })

  it('formats sub-minute as "jetzt"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-14T12:00:00Z'))
    expect(relTime('2026-06-14T11:59:30Z')).toBe('jetzt')
  })

  it('formats minutes, hours and days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-14T12:00:00Z'))
    expect(relTime('2026-06-14T11:30:00Z')).toBe('30 min')
    expect(relTime('2026-06-14T09:00:00Z')).toBe('3 h')
    expect(relTime('2026-06-12T12:00:00Z')).toBe('2 d')
  })

  it('falls back to a date once older than a week', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-14T12:00:00Z'))
    expect(relTime('2026-05-01T12:00:00Z')).not.toMatch(/min|jetzt| h$| d$/)
  })
})

describe('fmtPts', () => {
  it('drops the decimal for whole numbers', () => {
    expect(fmtPts(3)).toBe('3')
    expect(fmtPts(0)).toBe('0')
  })

  it('keeps one decimal for halves', () => {
    expect(fmtPts(2.5)).toBe('2.5')
  })
})

describe('formatCupDate', () => {
  it('returns empty string for falsy input', () => {
    expect(formatCupDate(null)).toBe('')
    expect(formatCupDate('')).toBe('')
  })

  it('anchors to noon so the calendar day never rolls back', () => {
    // The day must survive regardless of the runtime timezone offset.
    expect(formatCupDate('2026-06-14', { day: '2-digit', month: 'short' }))
      .toMatch(/14/)
  })

  it('passes the locale through', () => {
    expect(formatCupDate('2026-06-14', { month: 'long' }, 'en-US')).toBe('June')
  })
})
