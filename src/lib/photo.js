import { supabase } from './supabase'
import { fileExt } from './format'
import { stripFileMetadataForUpload } from './stripImageMetadata'

const BUCKET = 'match-photos'

/**
 * Bild aus einem Datei-Dialog metadatenfrei in einen public-read-Bucket laden
 * und die öffentliche URL zurückgeben.
 *
 * Einzige Quelle für die Sequenz strip → upload → getPublicUrl, die vorher in
 * jedem Bild-Feature (Cup-Cover, Sponsoren- und Team-Logos, Savor-Bilder,
 * Match- und Cup-Fotos) Wort für Wort dupliziert war. Damit liegt die
 * Bucket-Policy (kein Upsert, `cacheControl`) an einer Stelle.
 *
 * @param {string} bucket   Ziel-Bucket (public-read).
 * @param {string} key      Vollständiger Objektpfad im Bucket.
 * @param {File}   file     Die im Dialog gewählte Datei.
 * @param {{ contentType?: string, cacheControl?: string, upsert?: boolean }} [opts]
 * @returns {Promise<string|undefined>} Öffentliche URL – `undefined` nur, falls
 *   der Storage keine liefert; die Aufrufer prüfen das je nach Bedarf.
 */
export async function uploadPublicImage(bucket, key, file, opts = {}) {
  const { contentType = file?.type, cacheControl = '3600', upsert = false } = opts
  // Bucket ist public-read: EXIF/GPS raus, bevor die Bytes hochgehen.
  const bytes = await stripFileMetadataForUpload(file, bucket)
  const { error } = await supabase.storage.from(bucket)
    .upload(key, bytes, { cacheControl, upsert, contentType })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(key)
  return data?.publicUrl
}

export async function uploadMatchPhoto(matchId, file) {
  if (!file) return null
  // Match-Fotos entstehen auf dem Platz, der Bucket ist public-read.
  const key = `${matchId}/${Date.now()}.${fileExt(file, { max: 5 })}`
  const url = await uploadPublicImage(BUCKET, key, file, { contentType: file.type || 'image/jpeg' })
  if (!url) throw new Error('public url missing')
  const { error: dbErr } = await supabase.from('matches')
    .update({ photo_url: url }).eq('id', matchId)
  if (dbErr) throw dbErr
  return url
}

export async function clearMatchPhoto(matchId) {
  await supabase.from('matches').update({ photo_url: null }).eq('id', matchId)
}

export async function uploadCupCover(tournamentId, file) {
  if (!file) return null
  const key = `cups/${tournamentId}/${Date.now()}.${fileExt(file, { max: 5 })}`
  const url = await uploadPublicImage(BUCKET, key, file, { contentType: file.type || 'image/jpeg' })
  if (!url) throw new Error('public url missing')
  const { error: dbErr } = await supabase.from('tournaments')
    .update({ cover_url: url }).eq('id', tournamentId)
  if (dbErr) throw dbErr
  return url
}

export async function clearCupCover(tournamentId) {
  await supabase.from('tournaments').update({ cover_url: null }).eq('id', tournamentId)
}
