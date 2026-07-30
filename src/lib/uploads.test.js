import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase client before importing the module under test so the
// import-time `import { supabase }` binds to the mock. The storage surface is
// `supabase.storage.from(bucket).{ upload, getPublicUrl }`.
const uploadMock = vi.fn()
const getPublicUrlMock = vi.fn()
const storageFromMock = vi.fn(() => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock }))
vi.mock('./supabase', () => ({
  supabase: { storage: { from: (...a) => storageFromMock(...a) } },
}))

import { publicUrl, uploadToBucket } from './uploads'

beforeEach(() => {
  uploadMock.mockReset()
  getPublicUrlMock.mockReset()
  storageFromMock.mockClear()
})

describe('publicUrl', () => {
  it('returns the SDK publicUrl for a bucket + path', () => {
    getPublicUrlMock.mockReturnValue({ data: { publicUrl: 'https://cdn/x.jpg' } })
    expect(publicUrl('avatars', 'u/1.jpg')).toBe('https://cdn/x.jpg')
    expect(storageFromMock).toHaveBeenCalledWith('avatars')
    expect(getPublicUrlMock).toHaveBeenCalledWith('u/1.jpg')
  })

  it('degrades to undefined when the SDK returns no data', () => {
    getPublicUrlMock.mockReturnValue({ data: null })
    expect(publicUrl('avatars', 'u/1.jpg')).toBeUndefined()
  })
})

describe('uploadToBucket', () => {
  it('uploads with the given options and returns the public URL', async () => {
    uploadMock.mockResolvedValue({ error: null })
    getPublicUrlMock.mockReturnValue({ data: { publicUrl: 'https://cdn/c.png' } })
    const opts = { upsert: false, cacheControl: '3600', contentType: 'image/png' }
    const url = await uploadToBucket('cup-covers', 'c/1.png', 'FILE', opts)
    expect(url).toBe('https://cdn/c.png')
    expect(storageFromMock).toHaveBeenCalledWith('cup-covers')
    expect(uploadMock).toHaveBeenCalledWith('c/1.png', 'FILE', opts)
  })

  it('defaults options to an empty object when omitted', async () => {
    uploadMock.mockResolvedValue({ error: null })
    getPublicUrlMock.mockReturnValue({ data: { publicUrl: 'https://cdn/y' } })
    await uploadToBucket('b', 'p', 'F')
    expect(uploadMock).toHaveBeenCalledWith('p', 'F', {})
  })

  it('throws the raw StorageError and never reads a public URL on failure', async () => {
    const error = { message: 'quota exceeded' }
    uploadMock.mockResolvedValue({ error })
    await expect(uploadToBucket('b', 'p', 'F')).rejects.toBe(error)
    expect(getPublicUrlMock).not.toHaveBeenCalled()
  })
})
