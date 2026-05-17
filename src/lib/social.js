import { supabase } from './supabase'

export async function fetchSocialCounts(matchIds) {
  if (!matchIds?.length) return {}
  const { data } = await supabase.from('match_social_counts')
    .select('match_id,like_count,comment_count')
    .in('match_id', matchIds)
  const map = {}
  for (const row of (data || [])) {
    map[row.match_id] = { likes: row.like_count, comments: row.comment_count }
  }
  return map
}

export async function fetchMyReactions(matchIds, userId) {
  if (!matchIds?.length || !userId) return new Set()
  const { data } = await supabase.from('match_reactions')
    .select('match_id').in('match_id', matchIds).eq('user_id', userId)
  return new Set((data || []).map(r => r.match_id))
}

export async function toggleLike(matchId, userId, currentlyLiked) {
  if (currentlyLiked) {
    await supabase.from('match_reactions').delete()
      .eq('match_id', matchId).eq('user_id', userId)
    return false
  }
  await supabase.from('match_reactions').insert({ match_id: matchId, user_id: userId })
  return true
}

export async function listComments(matchId) {
  const { data } = await supabase.from('match_comments')
    .select('id,user_id,body,created_at,hidden')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })
    .limit(200)
  return data || []
}

export async function postComment(matchId, userId, body) {
  const trimmed = String(body || '').trim()
  if (!trimmed) return null
  const { data } = await supabase.from('match_comments')
    .insert({ match_id: matchId, user_id: userId, body: trimmed.slice(0, 800) })
    .select('id,user_id,body,created_at,hidden').single()
  return data
}

export async function deleteComment(commentId) {
  await supabase.from('match_comments').delete().eq('id', commentId)
}

export async function reportComment(commentId) {
  await supabase.rpc('report_comment', { c_id: commentId })
}
