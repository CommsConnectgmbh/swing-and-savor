import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { shareImageOrDownload } from './shareImage'

// Minimal args shared by every case. `blob` only needs to be something the
// jsdom File constructor accepts.
const baseArgs = () => ({
  blob: new Blob(['x'], { type: 'image/png' }),
  filename: 'card.png',
  title: 'Swing & Savor',
  text: 'Check this out',
  url: 'https://swingandsavor.at',
})

describe('shareImageOrDownload', () => {
  let origCanShare, origShare, origCreate, origRevoke

  beforeEach(() => {
    origCanShare = Object.getOwnPropertyDescriptor(navigator, 'canShare')
    origShare = Object.getOwnPropertyDescriptor(navigator, 'share')
    origCreate = URL.createObjectURL
    origRevoke = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    if (origCanShare) Object.defineProperty(navigator, 'canShare', origCanShare)
    else delete navigator.canShare
    if (origShare) Object.defineProperty(navigator, 'share', origShare)
    else delete navigator.share
    URL.createObjectURL = origCreate
    URL.revokeObjectURL = origRevoke
    vi.restoreAllMocks()
  })

  function setNav({ canShare, share }) {
    Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true, writable: true })
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true })
  }

  it('shares via the Web Share API when canShare accepts the file', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    setNav({ canShare: vi.fn(() => true), share })

    const result = await shareImageOrDownload(baseArgs())

    expect(result).toBe('shared')
    expect(share).toHaveBeenCalledTimes(1)
    const passed = share.mock.calls[0][0]
    expect(passed.files[0]).toBeInstanceOf(File)
    expect(passed).toMatchObject({ title: 'Swing & Savor', text: 'Check this out', url: 'https://swingandsavor.at' })
    // No download fallback on a successful share.
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('returns "cancelled" (no download) when the user aborts the share sheet', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    setNav({ canShare: vi.fn(() => true), share: vi.fn().mockRejectedValue(abort) })

    const result = await shareImageOrDownload(baseArgs())

    expect(result).toBe('cancelled')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('falls through to download when share rejects with a non-abort error', async () => {
    const boom = Object.assign(new Error('nope'), { name: 'NotAllowedError' })
    setNav({ canShare: vi.fn(() => true), share: vi.fn().mockRejectedValue(boom) })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const result = await shareImageOrDownload(baseArgs())

    expect(result).toBe('downloaded')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('downloads (with object-URL revoke) when the Web Share API is unavailable', async () => {
    // navigator.canShare absent → optional chaining short-circuits to the fallback.
    setNav({ canShare: undefined, share: undefined })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const result = await shareImageOrDownload(baseArgs())

    expect(result).toBe('downloaded')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
