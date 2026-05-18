// Vercel Edge Function — serves OG-stuffed HTML to social crawlers for /i/, /recap/, /hall/.
// Routed via vercel.json `has`-matcher on user-agent.
export const config = { runtime: 'edge' }

const SUPABASE_URL  = 'https://rcqichlyllhwougopfkg.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcWljaGx5bGxod291Z29wZmtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDA2MTksImV4cCI6MjA5NDUxNjYxOX0.s-vvEaz_cqT3pS5lHZvUPNOXILgJMq2qHVp4idUY_wY'

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function htmlShell({ title, description, image, url, type = 'website' }) {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(title)}</title>
<meta name="description"        content="${esc(description)}" />
<meta property="og:type"        content="${esc(type)}" />
<meta property="og:title"       content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
${image ? `<meta property="og:image" content="${esc(image)}" />` : ''}
${image ? `<meta property="og:image:width"  content="1200" />` : ''}
${image ? `<meta property="og:image:height" content="630" />`  : ''}
<meta property="og:url"         content="${esc(url)}" />
<meta property="og:site_name"   content="Swing & Savor" />
<meta name="twitter:card"       content="${image ? 'summary_large_image' : 'summary'}" />
<meta name="twitter:title"      content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
${image ? `<meta name="twitter:image" content="${esc(image)}" />` : ''}
<meta name="theme-color" content="#0A1A12" />
</head>
<body style="background:#0A1A12;color:#F4F1EA;font-family:Inter,sans-serif;padding:48px;max-width:720px;margin:0 auto;">
  <p style="font-size:11px;letter-spacing:0.4em;text-transform:uppercase;color:#D9C9A8;">Swing &amp; Savor</p>
  <h1 style="font-family:Georgia,serif;font-size:48px;line-height:1.05;margin:8px 0 16px;">${esc(title)}</h1>
  <p style="color:#9C968C;line-height:1.6;">${esc(description)}</p>
  <p style="margin-top:32px;"><a href="${esc(url)}" style="color:#D9C9A8;text-decoration:none;border-bottom:1px solid #D9C9A8;padding-bottom:2px;letter-spacing:0.2em;text-transform:uppercase;font-size:12px;">Open in the Clubhouse →</a></p>
</body>
</html>`
}

async function sb(path, params = {}) {
  const qs = new URLSearchParams(params).toString()
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${path}${qs ? `?${qs}` : ''}`,
    { headers: { apikey: SUPABASE_ANON } })
  if (!r.ok) return null
  return r.json()
}

export default async function handler(req) {
  const url = new URL(req.url)
  // The actual route path is passed via `?p=…` from vercel.json rewrite.
  const p = url.searchParams.get('p') || ''
  const fullUrl = `https://app.swingandsavor.at${p}`

  let payload = null

  try {
    if (p.startsWith('/i/')) {
      const slug = p.slice(3).replace(/\/+$/, '')
      const data = await sb('public-invitational', { invite: slug })
      if (data?.cup) {
        const c = data.cup
        payload = {
          title: `${c.name} · You're invited`,
          description: c.description
                       || `${c.team_a_name} vs ${c.team_b_name} · ${new Date(c.date).toLocaleDateString('de-DE')}${c.location_name ? ' · ' + c.location_name : ''}`,
          image: c.cover_url || null,
          url: fullUrl,
          type: 'article',
        }
      }
    } else if (p.startsWith('/recap/')) {
      const slug = p.slice(7).replace(/\/+$/, '')
      const data = await sb('public-recap', { invite: slug })
      if (data?.cup) {
        const c = data.cup
        const champ = c.champion ? `Champion: ${c.champion}` : 'Final Recap'
        payload = {
          title: `${champ} · ${c.name}`,
          description: c.description
                       || `${c.team_a_name} ${c.score_a} – ${c.score_b} ${c.team_b_name}${c.location_name ? '  ·  ' + c.location_name : ''}`,
          image: c.cover_url || null,
          url: fullUrl,
          type: 'article',
        }
      }
    } else if (p.startsWith('/hall/')) {
      const handle = p.slice(6).replace(/\/+$/, '')
      const data = await sb('public-hall', { handle })
      if (data?.captain) {
        const cap = data.captain
        const wins = (data.champion_tally || []).reduce((s, r) => s + r.wins, 0)
        payload = {
          title: `${cap.display_name || '@' + cap.handle} · Hall of Fame`,
          description: `${data.stats.cups_total} Cups · ${wins} Champions · Swing & Savor`,
          image: cap.avatar_url || null,
          url: fullUrl,
          type: 'profile',
        }
      }
    } else if (p.startsWith('/crew/')) {
      const slug = p.slice(6).replace(/\/+$/, '')
      const data = await sb('public-crew', { slug })
      if (data?.group) {
        const g = data.group
        const wins = (data.champion_tally || []).reduce((s, r) => s + r.wins, 0)
        payload = {
          title: `${g.name} · The Crew`,
          description: g.description
                       || `${data.stats.members_total} members · ${data.stats.cups_total} Cups · ${wins} Champions`,
          image: g.cover_url || null,
          url: fullUrl,
          type: 'article',
        }
      }
    } else if (p.startsWith('/season/')) {
      const slug = p.slice(8).replace(/\/+$/, '')
      const data = await sb('public-season', { slug })
      if (data?.season) {
        const s = data.season
        payload = {
          title: `${s.name} · Season`,
          description: s.description
                       || `${data.stats.cups_total} Cups · ${data.standings.length} teams · Swing & Savor`,
          image: s.cover_url || null,
          url: fullUrl,
          type: 'article',
        }
      }
    }
  } catch (err) {
    console.error('[og] err', err)
  }

  if (!payload) {
    payload = {
      title: 'Swing & Savor',
      description: 'The Premium Golf Lifestyle Club. Founder Invitationals, Cups, Hall of Fame.',
      image: 'https://app.swingandsavor.at/icons/icon-512.png',
      url: fullUrl,
    }
  }

  return new Response(htmlShell(payload), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600',
    },
  })
}
