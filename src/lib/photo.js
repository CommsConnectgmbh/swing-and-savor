import { supabase } from './supabase'
import { fileExt } from './format'

const BUCKET = 'match-photos'

export async function uploadMatchPhoto(matchId, file) {
  if (!file) return null
  const ext = fileExt(file, { max: 5 })
  const key = `${matchId}/${Date.now()}.${ext}`
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(key, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg',
  })
  if (upErr) throw upErr
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key)
  const url = data?.publicUrl
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
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(key, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg',
  })
  if (upErr) throw upErr
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key)
  const url = data?.publicUrl
  if (!url) throw new Error('public url missing')
  const { error: dbErr } = await supabase.from('tournaments')
    .update({ cover_url: url }).eq('id', tournamentId)
  if (dbErr) throw dbErr
  return url
}

export async function clearCupCover(tournamentId) {
  await supabase.from('tournaments').update({ cover_url: null }).eq('id', tournamentId)
}
