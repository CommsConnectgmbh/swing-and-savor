import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase storage client and the metadata stripper before importing
// the module under test, so its import-time bindings resolve to the mocks.
const uploadMock = vi.fn()
const getPublicUrlMock = vi.fn()
const fromMock = vi.fn(() => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock }))
vi.mock('./supabase', () => ({
  supabase: { storage: { from: (...a) => fromMock(...a) } },
}))
vi.mock('./stripImageMetadata', () => ({
  // Der Stripper wird in stripImageMetadata.test.js separat abgesichert; hier
  // reicht ein Durchreicher, der die Bytes markiert.
  stripFileMetadataForUpload: vi.fn(async () => new Uint8Array([1, 2, 3])),
}))

import { uploadPublicImage } from './photo'
import { stripFileMetadataForUpload } from './stripImageMetadata'

const file = { name: 'shot.jpg', type: 'image/jpeg' }

describe('uploadPublicImage', () => {
  beforeEach(() => {
    fromMock.mockClear()
    uploadMock.mockReset()
    getPublicUrlMock.mockReset()
    stripFileMetadataForUpload.mockClear()
  })

  it('strips metadata, uploads the bytes and returns the public URL', async () => {
    uploadMock.mockResolvedValue({ error: null })
    getPublicUrlMock.mockReturnValue({ data: { publicUrl: 'https://cdn/x.jpg' } })

    const url = await uploadPublicImage('cup-covers', 'a/cover.jpg', file)

    expect(url).toBe('https://cdn/x.jpg')
    expect(stripFileMetadataForUpload).toHaveBeenCalledWith(file, 'cup-covers')
    expect(fromMock).toHaveBeenCalledWith('cup-covers')
    expect(uploadMock).toHaveBeenCalledWith('a/cover.jpg', expect.any(Uint8Array), {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/jpeg',
    })
    expect(getPublicUrlMock).toHaveBeenCalledWith('a/cover.jpg')
  })

  it('defaults contentType to the file type and allows overrides', async () => {
    uploadMock.mockResolvedValue({ error: null })
    getPublicUrlMock.mockReturnValue({ data: { publicUrl: 'https://cdn/y.png' } })

    await uploadPublicImage('sponsor-logos', 'u/logo.png', { name: 'l.png', type: '' }, {
      contentType: file.type || undefined,
      cacheControl: '60',
      upsert: true,
    })

    expect(uploadMock).toHaveBeenCalledWith('u/logo.png', expect.any(Uint8Array), {
      cacheControl: '60',
      upsert: true,
      contentType: 'image/jpeg',
    })
  })

  it('throws when the storage upload fails', async () => {
    uploadMock.mockResolvedValue({ error: new Error('boom') })

    await expect(uploadPublicImage('savor-images', 'p/x.jpg', file)).rejects.toThrow('boom')
    expect(getPublicUrlMock).not.toHaveBeenCalled()
  })

  it('returns undefined when storage yields no public URL', async () => {
    uploadMock.mockResolvedValue({ error: null })
    getPublicUrlMock.mockReturnValue({ data: null })

    expect(await uploadPublicImage('cup-covers', 'a/cover.jpg', file)).toBeUndefined()
  })
})
