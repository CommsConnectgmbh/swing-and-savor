import { supabase } from './supabase'
import { fileExt } from './format'
import { BUCKETS, uploadPublic } from './storage'

export async function uploadMatchPhoto(matchId, file) {
  if (!file) return null
  const ext = fileExt(file, { max: 5 })
  const key = `${matchId}/${Date.now()}.${ext}`
  // Match-Fotos entstehen auf dem Platz, der Bucket ist public-read.
  const url = await uploadPublic(BUCKETS.matchPhotos, key, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg',
  })
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
  const ext = fileExt(file, { max: 5 })
  const key = `cups/${tournamentId}/${Date.now()}.${ext}`
  // Bucket ist public-read: EXIF/GPS raus, bevor die Bytes hochgehen.
  const url = await uploadPublic(BUCKETS.matchPhotos, key, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg',
  })
  if (!url) throw new Error('public url missing')
  const { error: dbErr } = await supabase.from('tournaments')
    .update({ cover_url: url }).eq('id', tournamentId)
  if (dbErr) throw dbErr
  return url
}

export async function clearCupCover(tournamentId) {
  await supabase.from('tournaments').update({ cover_url: null }).eq('id', tournamentId)
}
