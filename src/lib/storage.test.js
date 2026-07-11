import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase storage client before importing the module under test so
// the import-time `import { supabase }` binds to the mock.
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
    uploadMock.mockResolvedValue({ error: null })
    getPublicUrlMock.mockReturnValue({ data: { publicUrl: 'https://cdn/x.jpg' } })
  })

  it('uploads to the given bucket/path and returns the public URL', async () => {
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

  it('defaults contentType to image/jpeg when the file has no type', async () => {
    await uploadToBucket('b', 'p', {})
    expect(uploadMock.mock.calls[0][2].contentType).toBe('image/jpeg')
  })

  it('lets callers override the default options', async () => {
    await uploadToBucket('b', 'p', { type: 'image/png' }, { upsert: true, contentType: undefined })
    expect(uploadMock.mock.calls[0][2]).toEqual({
      cacheControl: '3600',
      upsert: true,
      contentType: undefined,
    })
  })

  it('throws when the upload fails', async () => {
    const boom = new Error('nope')
    uploadMock.mockResolvedValue({ error: boom })
    await expect(uploadToBucket('b', 'p', { type: 'image/jpeg' })).rejects.toBe(boom)
    expect(getPublicUrlMock).not.toHaveBeenCalled()
  })

  it('returns an empty string when no public URL comes back', async () => {
    getPublicUrlMock.mockReturnValue({ data: null })
    expect(await uploadToBucket('b', 'p', { type: 'image/jpeg' })).toBe('')
  })
})
