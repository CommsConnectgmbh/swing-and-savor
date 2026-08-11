import { describe, it, expect, vi, afterEach } from 'vitest'
import { relTime, fmtPts, formatCupDate, formatDateTime, fmtEur, fileExt } from './format'

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

describe('formatDateTime', () => {
  it('returns empty string for falsy input', () => {
    expect(formatDateTime(null)).toBe('')
    expect(formatDateTime('')).toBe('')
    expect(formatDateTime(undefined)).toBe('')
  })

  it('renders the default short date + time (day, month, hour, minute)', () => {
    // The exact day/hour depend on the runtime timezone, but the DD.MM date
    // and the HH:MM time separator are always present in the de-DE format.
    const out = formatDateTime('2026-06-14T12:00:00Z', undefined, 'de-DE')
    expect(out).toMatch(/\d{2}\.\d{2}/)
    expect(out).toMatch(/\d{2}:\d{2}/)
  })

  it('passes custom opts and locale through', () => {
    expect(formatDateTime('2026-06-14T09:05:00Z', { month: 'long' }, 'en-US'))
      .toMatch(/June/)
  })
})

describe('fmtEur', () => {
  it('formats cents as a EUR currency string (de default)', () => {
    // Non-breaking spaces vary by ICU build, so assert on the meaningful parts.
    expect(fmtEur(499)).toMatch(/4,99/)
    expect(fmtEur(499)).toMatch(/€/)
  })
})

describe('fileExt', () => {
  it('extracts a lower-cased extension', () => {
    expect(fileExt({ name: 'Scorecard.JPG' })).toBe('jpg')
    expect(fileExt({ name: 'photo.png' })).toBe('png')
  })

  it('uses the fallback when there is no extension', () => {
    expect(fileExt({ name: 'noext' })).toBe('noext')
    expect(fileExt({ name: '' })).toBe('jpg')
    expect(fileExt(null)).toBe('jpg')
    expect(fileExt({ name: '' }, { fallback: 'png' })).toBe('png')
  })

  it('truncates to max when requested', () => {
    expect(fileExt({ name: 'a.jpeg2000' }, { max: 5 })).toBe('jpeg2')
  })
})
