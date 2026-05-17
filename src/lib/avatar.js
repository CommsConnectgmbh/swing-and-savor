import { supabase } from './supabase'

const BUCKET = 'avatars'
const MAX_DIM = 512

// Best-effort downscale. Falls back to original blob if the browser doesn't
// support createImageBitmap (older Safari) — Supabase still accepts the file.
async function maybeDownscale(file) {
  try {
    if (typeof createImageBitmap !== 'function') return file
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 800 * 1024) return file  // small enough, skip work
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob = await new Promise((resolve) =>
      canvas.toBlob(b => resolve(b), 'image/jpeg', 0.85))
    return blob || file
  } catch (e) {
    console.warn('[avatar] downscale failed, using original:', e)
    return file
  }
}

export async function uploadAvatar(userId, file) {
  const blob = await maybeDownscale(file)
  const ext = (blob.type === 'image/png') ? 'png' : 'jpg'
  const path = `${userId}/avatar-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: true,
    cacheControl: '3600',
  })
  if (error) {
    console.error('[avatar] upload error:', error)
    throw error
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
