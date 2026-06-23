import { supabase } from './supabase'

// Single source of truth for "upload a file to a Supabase Storage bucket and
// hand back its public URL".
//
// The upload → getPublicUrl round-trip was hand-copied into every image-upload
// helper (avatars, match photos, cup covers, sponsor logos, savor images).
// Each copy repeated the same `{ cacheControl, upsert, contentType }` options
// and the same "read `publicUrl` off the response, hope it's there" dance, with
// nothing keeping them consistent — one site threw on a missing URL, another
// silently returned `undefined`, a third forgot the cache-control header.
// Centralising it removes ~6 duplicated blocks and gives every uploader the
// same defaults and the same fail-loud behaviour.

/**
 * Upload a file to a Supabase Storage bucket and return its public URL.
 *
 * Defaults match the common image-upload call site. Override any
 * Supabase UploadOptions field (e.g. `upsert`, `contentType`) via `opts`;
 * the spread runs last, so an explicit `contentType: undefined` wins over the
 * default and is forwarded verbatim to Supabase.
 *
 * @param {string} bucket   Storage bucket name, e.g. `'avatars'`.
 * @param {string} path     Object key within the bucket.
 * @param {Blob|File} file   The file/blob to upload.
 * @param {object} [opts]    Supabase UploadOptions overrides.
 * @returns {Promise<string>} The object's public URL.
 * @throws if the upload fails or no public URL is returned.
 */
export async function uploadToBucket(bucket, path, file, opts = {}) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file?.type || 'image/jpeg',
    ...opts,
  })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  const url = data?.publicUrl
  if (!url) throw new Error(`storage: public url missing for ${bucket}/${path}`)
  return url
}
