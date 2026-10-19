// Public Savor endpoint. Returns featured offers + per-category counts for the
// Savor home, or a single category listing, or a single offer detail.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function j(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...CORS, ...(init.headers || {}) },
  })
}

const CATEGORIES = ['tee_times','experiences','dining','apparel','travel','equipment'] as const

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'GET')     return j({ error: 'method_not_allowed' }, { status: 405 })

  const url = new URL(req.url)
  const mode    = url.searchParams.get('mode')     || 'home'
  const cat     = url.searchParams.get('category') || ''
  const slug    = url.searchParams.get('slug')     || ''
  const cityRaw = url.searchParams.get('city')     || ''

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  if (mode === 'offer' && slug) {
    const { data: offer } = await supabase
      .from('savor_offers')
      .select('*, partner:partner_id(name, slug, logo_url, website_url, city, country_code, description)')
      .eq('slug', slug).maybeSingle()
    if (!offer) return j({ error: 'not_found' }, { status: 404 })
    if (!['active','sold_out'].includes(offer.status)) return j({ error: 'unavailable' }, { status: 403 })
    return j({ offer })
  }

  if (mode === 'category' && cat && CATEGORIES.includes(cat as any)) {
    let q = supabase.from('savor_offers')
      .select('id, category, title, slug, subtitle, image_url, city, country_code, price_eur_cents, price_label, currency, badge, status, tee_time_at, partner:partner_id(name, logo_url)')
      .eq('category', cat)
      .in('status', ['active','sold_out'])
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(120)
    if (cityRaw) q = q.ilike('city', `%${cityRaw}%`)
    const { data: offers } = await q
    return j({ category: cat, offers: offers || [] })
  }

  // mode === 'home': featured highlights + counts per category
  const { data: featured } = await supabase
    .from('savor_offers')
    .select('id, category, title, slug, subtitle, image_url, city, price_eur_cents, price_label, currency, badge, status, partner:partner_id(name, logo_url)')
    .eq('highlight', true)
    .in('status', ['active','sold_out'])
    .order('sort_order', { ascending: true })
    .limit(6)

  // Per-category counts (simple, parallel)
  const counts: Record<string, number> = {}
  await Promise.all(CATEGORIES.map(async (c) => {
    const { count } = await supabase
      .from('savor_offers')
      .select('id', { head: true, count: 'exact' })
      .eq('category', c)
      .in('status', ['active','sold_out'])
    counts[c] = count || 0
  }))

  // 3 latest per category as preview
  const previewByCat: Record<string, any[]> = {}
  await Promise.all(CATEGORIES.map(async (c) => {
    const { data } = await supabase.from('savor_offers')
      .select('id, title, slug, image_url, city, price_label, price_eur_cents, badge, status, partner:partner_id(name, logo_url)')
      .eq('category', c)
      .in('status', ['active','sold_out'])
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(3)
    previewByCat[c] = data || []
  }))

  return j({ featured: featured || [], counts, preview_by_category: previewByCat })
})
