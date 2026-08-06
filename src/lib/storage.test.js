import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase client before importing the module under test so the
// import-time `import { supabase }` binds to the mock.
const uploadMock = vi.fn()
const getPublicUrlMock = vi.fn()
const fromMock = vi.fn(() => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock }))
vi.mock('./supabase', () => ({ supabase: { storage: { from: (...a) => fromMock(...a) } } }))

import { uploadToBucket } from './storage'

describe('uploadToBucket', () => {
  beforeEach(() => {
    uploadMock.mockReset()
    getPublicUrlMock.mockReset()
    fromMock.mockClear()
  })

  it('uploads with sensible defaults and returns the public URL', async () => {
    uploadMock.mockResolvedValue({ error: null })
    getPublicUrlMock.mockReturnValue({ data: { publicUrl: 'https://cdn/x.jpg' } })

    const file = { type: 'image/png' }
    const url = await uploadToBucket('avatars', 'u/1.png', file)

    expect(url).toBe('https://cdn/x.jpg')
    expect(fromMock).toHaveBeenCalledWith('avatars')
    expect(uploadMock).toHaveBeenCalledWith('u/1.png', file, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/png',
    })
    expect(getPublicUrlMock).toHaveBeenCalledWith('u/1.png')
  })

  it('falls back to image/jpeg when the file has no type', async () => {
    uploadMock.mockResolvedValue({ error: null })
    getPublicUrlMock.mockReturnValue({ data: { publicUrl: 'https://cdn/x' } })

    await uploadToBucket('b', 'p', {})

    expect(uploadMock.mock.calls[0][2].contentType).toBe('image/jpeg')
  })

  it('lets opts override the defaults (including an explicit undefined)', async () => {
    uploadMock.mockResolvedValue({ error: null })
    getPublicUrlMock.mockReturnValue({ data: { publicUrl: 'https://cdn/x' } })

    await uploadToBucket('b', 'p', { type: 'image/png' }, { upsert: true, contentType: undefined })

    const opts = uploadMock.mock.calls[0][2]
    expect(opts.upsert).toBe(true)
    expect('contentType' in opts).toBe(true)
    expect(opts.contentType).toBeUndefined()
  })

  it('throws when the upload fails', async () => {
    uploadMock.mockResolvedValue({ error: new Error('boom') })
    await expect(uploadToBucket('b', 'p', {})).rejects.toThrow('boom')
    expect(getPublicUrlMock).not.toHaveBeenCalled()
  })

  it('throws when no public URL is returned', async () => {
    uploadMock.mockResolvedValue({ error: null })
    getPublicUrlMock.mockReturnValue({ data: { publicUrl: '' } })
    await expect(uploadToBucket('b', 'p', {})).rejects.toThrow(/public url missing/)
  })
})
