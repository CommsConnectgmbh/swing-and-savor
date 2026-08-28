import { describe, it, expect, beforeEach, vi } from 'vitest'
import { localStore, sessionStore } from './storage'

describe('localStore', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips string values', () => {
    expect(localStore.set('k', 'v')).toBe(true)
    expect(localStore.get('k')).toBe('v')
  })

  it('returns the fallback for a missing key', () => {
    expect(localStore.get('nope')).toBe(null)
    expect(localStore.get('nope', 'dflt')).toBe('dflt')
  })

  it('removes keys', () => {
    localStore.set('k', 'v')
    localStore.remove('k')
    expect(localStore.get('k')).toBe(null)
  })

  it('round-trips JSON values', () => {
    localStore.setJSON('pars', [3, 4, 5])
    expect(localStore.getJSON('pars')).toEqual([3, 4, 5])
  })

  it('returns the fallback when JSON is missing or unparseable', () => {
    expect(localStore.getJSON('missing')).toBe(null)
    expect(localStore.getJSON('missing', [])).toEqual([])
    localStore.set('bad', 'not json{')
    expect(localStore.getJSON('bad', 'fb')).toBe('fb')
  })

  it('clears the whole store', () => {
    localStore.set('a', '1')
    localStore.set('b', '2')
    localStore.clear()
    expect(localStore.get('a')).toBe(null)
    expect(localStore.get('b')).toBe(null)
  })

  it('never throws and reports failure when the backend throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    expect(localStore.set('k', 'v')).toBe(false)
    expect(() => localStore.set('k', 'v')).not.toThrow()
    spy.mockRestore()
  })

  it('falls back instead of throwing when reads throw', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })
    expect(localStore.get('k', 'fb')).toBe('fb')
    expect(localStore.getJSON('k', 'fb')).toBe('fb')
    spy.mockRestore()
  })
})

describe('sessionStore', () => {
  beforeEach(() => sessionStorage.clear())

  it('round-trips values independently of localStorage', () => {
    sessionStore.set('unlocked', '1')
    expect(sessionStore.get('unlocked')).toBe('1')
    expect(localStore.get('unlocked')).toBe(null)
  })
})
