import { supabase } from './supabase'
import { stripFileMetadataForUpload } from './stripImageMetadata'

// Single source of truth for Supabase Storage uploads.
//
// The exact "strip camera metadata → storage.upload → throw on error →
// getPublicUrl" sequence was hand-copied into nine call sites across six files
// (avatar.js, photo.js ×2, AdminScreen, HomeScreen, CupExtrasSheet ×3,
// ScorecardSheet). Every copy had to keep the same upload options and the same
// EXIF/GPS-strip step byte-identical, but nothing enforced it — and the copies
// had already drifted (e.g. one cup-cover path wrote to a different bucket than
// the others). Centralising the shared middle here keeps the metadata strip on
// every upload path and gives each bucket name one home.
//
// Callers still own their bucket, path scheme, upload options and the DB write
// that records the resulting URL — only the mechanical upload core moves here.

// The Storage buckets the app uploads to. The strip step below logs under the
// bucket name, so these values double as the log labels the call sites used.
export const BUCKETS = {
  avatars:         'avatars',
  matchPhotos:     'match-photos',
  cupCovers:       'cup-covers',
  sponsorLogos:    'sponsor-logos',
  savorImages:     'savor-images',
  scorecardPhotos: 'scorecard-photos',
}

// Strip EXIF/GPS metadata from `file`, then upload the bytes to `bucket/path`.
// `options` is forwarded verbatim to supabase.storage.upload (contentType,
// upsert, cacheControl — whatever the caller needs). Throws the upload error on
// failure, matching every previous call site. The metadata strip logs under the
// bucket name, so its console output is unchanged.
export async function uploadToBucket(bucket, path, file, options) {
  const bytes = await stripFileMetadataForUpload(file, bucket)
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, options)
  if (error) throw error
}

// As uploadToBucket, then resolve and return the public URL for `path`. Use for
// public-read buckets whose URL the caller stores on a row; private buckets
// (e.g. scorecard-photos) call uploadToBucket directly and keep the path.
export async function uploadPublic(bucket, path, file, options) {
  await uploadToBucket(bucket, path, file, options)
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data?.publicUrl
}
