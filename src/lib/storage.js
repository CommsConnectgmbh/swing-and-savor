import { supabase } from './supabase'

// Shared Supabase Storage upload helper.
//
// The "upload a blob to a bucket, then read back its public URL" sequence was
// copy-pasted across the image-upload paths (match photos, avatars, cup covers,
// sponsor/team logos, savor images) in lib/photo.js, lib/avatar.js,
// HomeScreen, AdminScreen and CupExtrasSheet. Each copy repeated the same
// `.upload(...)` → error check → `.getPublicUrl(...)` dance, so the default
// options (`cacheControl`, `upsert`) drifted between call sites. Centralising it
// keeps a single source of truth; callers pass only what differs (bucket, path
// and any option overrides such as `upsert: true` or a specific `contentType`).

/**
 * Upload a file to a Storage bucket and return its public URL.
 *
 * Throws on upload error (same as the hand-rolled call sites did). The default
 * options match the previous shared behaviour; pass `options` to override them
 * per call site (e.g. `{ upsert: true }` for avatars).
 *
 * @param {string} bucket   Storage bucket name.
 * @param {string} path     Object key within the bucket.
 * @param {Blob|File} file  The blob/file to upload.
 * @param {object} [options] Overrides for Supabase's upload options.
 * @returns {Promise<string>} The object's public URL.
 */
export async function uploadToBucket(bucket, path, file, options = {}) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file?.type || 'image/jpeg',
    ...options,
  })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data?.publicUrl || ''
}
