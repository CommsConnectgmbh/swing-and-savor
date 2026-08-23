import { renderHook } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { useSheetBody } from './useSheet'

afterEach(() => {
  document.body.className = ''
  document.body.style.overflow = ''
})

describe('useSheetBody', () => {
  it('adds the sheet-open class on mount and removes it on unmount', () => {
    const { unmount } = renderHook(() => useSheetBody())
    expect(document.body.classList.contains('sheet-open')).toBe(true)
    // scroll is not locked unless asked
    expect(document.body.style.overflow).toBe('')
    unmount()
    expect(document.body.classList.contains('sheet-open')).toBe(false)
  })

  it('locks body scroll only when lockScroll is set, and restores it on unmount', () => {
    const { unmount } = renderHook(() => useSheetBody({ lockScroll: true }))
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('does nothing while inactive', () => {
    renderHook(() => useSheetBody({ active: false, lockScroll: true, onEscape: () => {} }))
    expect(document.body.classList.contains('sheet-open')).toBe(false)
    expect(document.body.style.overflow).toBe('')
  })

  it('calls onEscape for Escape only, and detaches the listener on unmount', () => {
    const onEscape = vi.fn()
    const { unmount } = renderHook(() => useSheetBody({ onEscape }))

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onEscape).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(onEscape).toHaveBeenCalledTimes(1)

    unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('does not attach a keydown listener when no onEscape is given', () => {
    const spy = vi.spyOn(window, 'addEventListener')
    const { unmount } = renderHook(() => useSheetBody())
    expect(spy.mock.calls.some(([type]) => type === 'keydown')).toBe(false)
    unmount()
    spy.mockRestore()
  })
})
