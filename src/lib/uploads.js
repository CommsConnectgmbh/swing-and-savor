import { supabase } from './supabase'

// Centralised Supabase Storage access for the "upload a file, then read its
// public URL" idiom. Before this module that two-step dance
// (`storage.from(bucket).upload(...)` → `if (error) throw` →
// `storage.from(bucket).getPublicUrl(path).data.publicUrl`) was hand-rolled in
// the view layer (CupExtrasSheet ×4, HomeScreen, AdminScreen) and re-spelled
// inside lib/avatar.js and lib/photo.js. A single source of truth keeps the
// bucket-access shape from drifting per call site.
//
// NB: this is storage-bucket access, distinct from Web Storage
// (localStorage/sessionStorage) — hence `uploads`, not `storage`.

// Public URL for an object already stored in a bucket. `getPublicUrl` performs
// no network request and always resolves synchronously to
// `{ data: { publicUrl } }`; the optional chain only guards against an
// unexpected SDK shape.
export function publicUrl(bucket, path) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data?.publicUrl
}

// Upload a file/blob to `bucket` at `path`, then return its public URL. Throws
// the raw Supabase StorageError on upload failure — callers keep owning their
// own catch/UX — reproducing the `if (error) throw error` idiom it replaces.
// `options` is passed verbatim to `upload()` so each call site keeps its exact
// upsert / cacheControl / contentType shape.
export async function uploadToBucket(bucket, path, file, options = {}) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, options)
  if (error) throw error
  return publicUrl(bucket, path)
}
