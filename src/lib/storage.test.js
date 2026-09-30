import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase.storage and the metadata-strip before importing the module, so
// the module-under-test binds to these mocks at import time.
const uploadMock = vi.fn()
const getPublicUrlMock = vi.fn()
const storageFromMock = vi.fn(() => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock }))
vi.mock('./supabase', () => ({
  supabase: { storage: { from: (...a) => storageFromMock(...a) } },
}))

const stripMock = vi.fn(async () => new Uint8Array([1, 2, 3]))
vi.mock('./stripImageMetadata', () => ({
  stripFileMetadataForUpload: (...a) => stripMock(...a),
}))

import { BUCKETS, uploadToBucket, uploadPublic } from './storage'

const FILE = { name: 'photo.jpg', type: 'image/jpeg' }

beforeEach(() => {
  uploadMock.mockReset()
  getPublicUrlMock.mockReset()
  storageFromMock.mockClear()
  stripMock.mockClear()
  uploadMock.mockResolvedValue({ error: null })
  getPublicUrlMock.mockReturnValue({ data: { publicUrl: 'https://cdn/x.jpg' } })
})

describe('BUCKETS', () => {
  it('exposes the exact bucket names the call sites use', () => {
    expect(BUCKETS).toEqual({
      avatars:         'avatars',
      matchPhotos:     'match-photos',
      cupCovers:       'cup-covers',
      sponsorLogos:    'sponsor-logos',
      savorImages:     'savor-images',
      scorecardPhotos: 'scorecard-photos',
    })
  })
})

describe('uploadToBucket', () => {
  it('strips metadata (logging under the bucket name) then uploads the bytes with the given options', async () => {
    const opts = { contentType: 'image/jpeg', upsert: false, cacheControl: '3600' }
    await uploadToBucket(BUCKETS.matchPhotos, 'm1/1.jpg', FILE, opts)

    expect(stripMock).toHaveBeenCalledWith(FILE, 'match-photos')
    expect(storageFromMock).toHaveBeenCalledWith('match-photos')
    expect(uploadMock).toHaveBeenCalledWith('m1/1.jpg', new Uint8Array([1, 2, 3]), opts)
  })

  it('throws the upload error and never resolves a URL', async () => {
    const err = new Error('boom')
    uploadMock.mockResolvedValue({ error: err })
    await expect(uploadToBucket('avatars', 'a/1.jpg', FILE, {})).rejects.toBe(err)
    expect(getPublicUrlMock).not.toHaveBeenCalled()
  })

  it('does not resolve a public URL', async () => {
    const out = await uploadToBucket('scorecard-photos', 'm1/1.jpg', FILE, {})
    expect(out).toBeUndefined()
    expect(getPublicUrlMock).not.toHaveBeenCalled()
  })
})

describe('uploadPublic', () => {
  it('uploads then returns the public URL for the same path', async () => {
    const url = await uploadPublic(BUCKETS.cupCovers, 'c1/cover.jpg', FILE, { upsert: false })

    expect(uploadMock).toHaveBeenCalledWith('c1/cover.jpg', new Uint8Array([1, 2, 3]), { upsert: false })
    expect(getPublicUrlMock).toHaveBeenCalledWith('c1/cover.jpg')
    expect(url).toBe('https://cdn/x.jpg')
  })

  it('propagates an upload failure without calling getPublicUrl', async () => {
    const err = new Error('nope')
    uploadMock.mockResolvedValue({ error: err })
    await expect(uploadPublic('avatars', 'a/1.jpg', FILE, {})).rejects.toBe(err)
    expect(getPublicUrlMock).not.toHaveBeenCalled()
  })

  it('returns undefined when the URL is missing, so callers can guard on it', async () => {
    getPublicUrlMock.mockReturnValue({ data: null })
    expect(await uploadPublic('match-photos', 'm/1.jpg', FILE, {})).toBeUndefined()
  })
})
