import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  readLocal,
  writeLocal,
  removeLocal,
  clearLocal,
  readLocalJson,
  writeLocalJson,
  readSession,
  writeSession,
  clearSession,
} from './storage'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('localStorage helpers (happy path)', () => {
  it('round-trips a string value', () => {
    expect(writeLocal('k', 'v')).toBe(true)
    expect(readLocal('k')).toBe('v')
  })

  it('returns the fallback for a missing key', () => {
    expect(readLocal('missing')).toBe(null)
    expect(readLocal('missing', 'fallback')).toBe('fallback')
  })

  it('removes a key', () => {
    writeLocal('k', 'v')
    expect(removeLocal('k')).toBe(true)
    expect(readLocal('k')).toBe(null)
  })

  it('clears all keys', () => {
    writeLocal('a', '1')
    writeLocal('b', '2')
    expect(clearLocal()).toBe(true)
    expect(readLocal('a')).toBe(null)
    expect(readLocal('b')).toBe(null)
  })
})

describe('JSON helpers', () => {
  it('round-trips an object', () => {
    expect(writeLocalJson('obj', { a: 1, b: [2, 3] })).toBe(true)
    expect(readLocalJson('obj')).toEqual({ a: 1, b: [2, 3] })
  })

  it('returns the fallback for a missing key', () => {
    expect(readLocalJson('missing')).toBe(null)
    expect(readLocalJson('missing', [])).toEqual([])
  })

  it('returns the fallback for non-JSON text', () => {
    localStorage.setItem('bad', 'not json{')
    expect(readLocalJson('bad')).toBe(null)
    expect(readLocalJson('bad', 42)).toBe(42)
  })
})

describe('sessionStorage helpers', () => {
  it('round-trips a value and clears', () => {
    expect(writeSession('s', 'v')).toBe(true)
    expect(readSession('s')).toBe('v')
    expect(clearSession()).toBe(true)
    expect(readSession('s')).toBe(null)
  })
})

describe('resilience when storage throws', () => {
  it('reads return the fallback instead of throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readLocal('k', 'fb')).toBe('fb')
    expect(readLocalJson('k', 'fb')).toBe('fb')
    expect(readSession('k', 'fb')).toBe('fb')
  })

  it('writes report false instead of throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(writeLocal('k', 'v')).toBe(false)
    expect(writeLocalJson('k', { a: 1 })).toBe(false)
    expect(writeSession('k', 'v')).toBe(false)
  })

  it('remove/clear report false instead of throwing', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(removeLocal('k')).toBe(false)
    expect(clearLocal()).toBe(false)
    expect(clearSession()).toBe(false)
  })
})
