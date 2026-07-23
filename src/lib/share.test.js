import { afterEach, describe, it, expect, vi } from 'vitest'
import { currentUrl } from './share'

describe('currentUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the current window location href in a browser context', () => {
    // jsdom provides a window; the helper must mirror window.location.href exactly.
    expect(currentUrl()).toBe(window.location.href)
  })

  it('reflects the live location after navigation', () => {
    window.history.pushState({}, '', '/hall/some-handle?x=1')
    expect(currentUrl()).toBe(window.location.href)
    expect(currentUrl()).toContain('/hall/some-handle?x=1')
  })

  it('falls back to an empty string when window is undefined (SSR / prerender)', () => {
    vi.stubGlobal('window', undefined)
    expect(currentUrl()).toBe('')
  })
})
