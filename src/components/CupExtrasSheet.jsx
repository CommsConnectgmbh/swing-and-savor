import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { fileExt } from '../lib/format'
import { uploadToBucket } from '../lib/uploads'
import QrCodeSheet from './QrCodeSheet'

const AWARD_TYPES = [
  ['champion',         'Champion'],
  ['runner_up',        'Runner-Up'],
  ['longest_drive',    'Longest Drive'],
  ['closest_to_pin',   'Closest to the Pin'],
  ['mvp',              'MVP'],
  ['rivalry',          'Rivalry Winner'],
  ['custom',           'Custom Honour'],
]

/**
 * Captain self-service sheet for a single Cup:
 *  - Cover-Image-Upload to `cup-covers` bucket → updates tournaments.cover_url
 *  - Award-Editor (add / delete)
 *  - Sponsor-Picker (create new sponsor + place on cup as "Powered by")
 */
export default function CupExtrasSheet({ cup, onClose, onChanged }) {
  const { user } = useAuth()
  const [tab, setTab] = useState('cover')
  const [busy, setBusy] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)

  // Cover state
  const [coverUrl, setCoverUrl] = useState(cup?.cover_url || '')

  // Awards state
  const [awards, setAwards] = useState([])
  const [awardForm, setAwardForm] = useState({ award_type: 'champion', title: '', recipient_name: '', description: '' })

  // Sponsor state
  const [placements, setPlacements] = useState([])
  const [sponsorForm, setSponsorForm] = useState({ name: '', website_url: '', logo_url: '' })

  useEffect(() => {
    if (!cup) return
    loadAwards()
    loadSponsors()
  }, [cup?.id])

  async function loadAwards() {
    const { data } = await supabase.from('awards')
      .select('*').eq('tournament_id', cup.id).order('created_at', { ascending: true })
    setAwards(data || [])
  }

  async function loadSponsors() {
    const { data } = await supabase.from('sponsor_placements')
      .select('id, placement_type, status, sponsor:sponsor_id(id,name,logo_url,website_url)')
      .eq('tournament_id', cup.id)
      .eq('status', 'active')
    setPlacements(data || [])
  }

  // ── Cover ─────────────────────────────────────────────────────────────────
  async function handleCoverFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const ext = fileExt(file)
      const path = `${cup.id}/cover-${Date.now()}.${ext}`
      const newUrl = await uploadToBucket('cup-covers', path, file, { upsert: false, cacheControl: '3600', contentType: file.type })
      await supabase.from('tournaments').update({ cover_url: newUrl }).eq('id', cup.id)
      setCoverUrl(newUrl)
      onChanged?.()
    } catch (err) {
      console.error('[cover] upload', err)
      alert('Upload fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  async function removeCover() {
    if (!coverUrl) return
    setBusy(true)
    await supabase.from('tournaments').update({ cover_url: null }).eq('id', cup.id)
    setCoverUrl('')
    setBusy(false)
    onChanged?.()
  }

  // ── Awards ────────────────────────────────────────────────────────────────
  async function addAward(e) {
    e.preventDefault()
    if (!awardForm.title.trim()) return
    setBusy(true)
    await supabase.from('awards').insert({
      tournament_id: cup.id,
      award_type:    awardForm.award_type,
      title:         awardForm.title.trim(),
      description:   awardForm.description.trim() || null,
      recipient_name: awardForm.recipient_name.trim() || null,
    })
    setAwardForm({ award_type: awardForm.award_type, title: '', recipient_name: '', description: '' })
    setBusy(false)
    loadAwards()
  }

  async function removeAward(id) {
    await supabase.from('awards').delete().eq('id', id)
    loadAwards()
  }

  // ── Sponsor ───────────────────────────────────────────────────────────────
  async function handleSponsorLogoFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const ext = fileExt(file, { fallback: 'png' })
      const path = `${user.id}/sponsor-${Date.now()}.${ext}`
      const logoUrl = await uploadToBucket('sponsor-logos', path, file, { upsert: false, cacheControl: '3600', contentType: file.type })
      setSponsorForm((f) => ({ ...f, logo_url: logoUrl }))
    } catch (err) {
      console.error('[sponsor] upload', err)
      alert('Logo-Upload fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  async function attachSponsor(e) {
    e.preventDefault()
    if (!sponsorForm.name.trim()) return
    setBusy(true)
    try {
      const { data: sp, error: sErr } = await supabase.from('sponsors').insert({
        name:        sponsorForm.name.trim(),
        website_url: sponsorForm.website_url.trim() || null,
        logo_url:    sponsorForm.logo_url || null,
        created_by:  user.id,
      }).select('id').single()
      if (sErr) throw sErr
      await supabase.from('sponsor_placements').insert({
        tournament_id: cup.id,
        sponsor_id:    sp.id,
        placement_type:'powered_by',
        status:        'active',
      })
      setSponsorForm({ name: '', website_url: '', logo_url: '' })
      loadSponsors()
      onChanged?.()
    } catch (err) {
      console.error('[sponsor] attach', err)
      alert('Sponsor konnte nicht hinzugefügt werden.')
    } finally {
      setBusy(false)
    }
  }

  async function removeSponsor(placementId) {
    await supabase.from('sponsor_placements')
      .update({ status: 'removed' }).eq('id', placementId)
    loadSponsors()
    onChanged?.()
  }

  if (!cup) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-up"
         onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
           className="w-full sm:max-w-md bg-bg hairline-t sm:hairline sm:rounded-card rounded-t-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-3">
            <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted">Cup Settings</p>
            <p className="font-display text-ink text-[18px] truncate" style={{ fontWeight: 500 }}>{cup.name}</p>
          </div>
          <button onClick={onClose} className="text-inkMuted text-2xl leading-none p-1" aria-label="Close">×</button>
        </div>

        {/* Tabs */}
        <div className="flex hairline-b overflow-x-auto">
          {[
            ['cover',    'Cover'],
            ['teams',    'Teams'],
            ['awards',   'Awards'],
            ['sponsors', 'Sponsor'],
            ['qr',       'QR'],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 py-3 text-[11px] tracking-[0.22em] uppercase ${
                tab === id ? 'text-accent border-b border-accent' : 'text-inkMuted'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">

          {tab === 'cover' && (
            <div className="space-y-4">
              {coverUrl ? (
                <div className="relative aspect-[16/10] rounded-card hairline overflow-hidden">
                  <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                  <div className="absolute inset-0"
                       style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(10,10,10,0.85))' }} />
                  <p className="absolute bottom-3 left-4 right-4 font-display text-ink text-[20px] leading-tight"
                     style={{ fontWeight: 500 }}>{cup.name}</p>
                </div>
              ) : (
                <div className="aspect-[16/10] hairline flex items-center justify-center text-inkDim text-xs tracking-[0.2em] uppercase bg-surface/40">
                  No cover
                </div>
              )}
              <label className="block w-full text-center py-4 bg-accent text-bg text-[12px] font-medium tracking-[0.28em] uppercase cursor-pointer active:scale-[0.99] transition-transform">
                {busy ? '…' : (coverUrl ? 'Replace Cover' : 'Upload Cover')}
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverFile} disabled={busy} />
              </label>
              {coverUrl && (
                <button onClick={removeCover}
                        className="block w-full py-3 hairline text-inkMuted text-[11px] tracking-[0.22em] uppercase active:scale-[0.99]">
                  Remove cover
                </button>
              )}
              <p className="text-[11px] text-inkDim text-center leading-relaxed">
                Empfohlene Größe 1600×1000. Dunkle, ruhige Motive funktionieren am besten.
              </p>
            </div>
          )}

          {tab === 'awards' && (
            <div className="space-y-5">
              <form onSubmit={addAward} className="hairline p-4 bg-surface/40 flex flex-col gap-2">
                <select value={awardForm.award_type}
                        onChange={(e) => setAwardForm({...awardForm, award_type: e.target.value})}
                        className="bg-bg hairline px-3 py-2.5 text-ink text-sm">
                  {AWARD_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
                <input className="bg-bg hairline px-3 py-2.5 text-ink text-sm"
                       placeholder="Award-Titel · z.B. Founder Invitational Winner"
                       value={awardForm.title}
                       onChange={(e) => setAwardForm({...awardForm, title: e.target.value})} />
                <input className="bg-bg hairline px-3 py-2.5 text-ink text-sm"
                       placeholder="Empfänger-Name · z.B. Tiger W."
                       value={awardForm.recipient_name}
                       onChange={(e) => setAwardForm({...awardForm, recipient_name: e.target.value})} />
                <textarea className="bg-bg hairline px-3 py-2.5 text-ink text-sm" rows={2}
                       placeholder="Beschreibung (optional)"
                       value={awardForm.description}
                       onChange={(e) => setAwardForm({...awardForm, description: e.target.value})} />
                <button disabled={busy}
                        className="mt-1 py-2.5 bg-accent text-bg text-[11px] font-medium tracking-[0.24em] uppercase disabled:opacity-50">
                  {busy ? 'Saving…' : 'Add Award'}
                </button>
              </form>

              <ul className="space-y-2">
                {awards.length === 0 && (
                  <li className="text-inkDim text-sm py-4 text-center">Noch keine Awards.</li>
                )}
                {awards.map((a) => (
                  <li key={a.id} className="hairline p-3 bg-surface/40 flex items-center justify-between">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-[9px] tracking-[0.32em] uppercase text-accent">
                        {AWARD_TYPES.find(([id]) => id === a.award_type)?.[1] || a.award_type}
                      </p>
                      <p className="text-ink text-[14px]">{a.title}</p>
                      {a.recipient_name && <p className="text-[11px] text-inkMuted">→ {a.recipient_name}</p>}
                    </div>
                    <button onClick={() => removeAward(a.id)}
                            className="text-inkDim hover:text-danger text-lg leading-none p-1">×</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === 'teams' && (
            <TeamsTab cup={cup} busy={busy} setBusy={setBusy} onChanged={onChanged} />
          )}

          {tab === 'qr' && (
            <div className="space-y-4">
              <p className="text-[11px] text-inkMuted leading-relaxed">
                Premium-Tischaufsteller mit QR-Code. Druckbar als A4 oder als
                iPad-Standee — Gäste scannen, kommen direkt auf die Invitational-Page.
              </p>
              <button
                onClick={() => setQrOpen(true)}
                className="block w-full text-center py-4 bg-accent text-brandDark text-[12px] font-medium tracking-[0.28em] uppercase active:scale-[0.99] transition-transform">
                QR-Tischaufsteller öffnen
              </button>
              <div className="hairline p-4 bg-surface/40 text-center">
                <p className="text-[9px] tracking-[0.32em] uppercase text-inkDim mb-2">Direkt-Link</p>
                <p className="text-[12px] text-accent tracking-wider break-all">
                  swingandsavor.at/i/{cup.invite_code}
                </p>
              </div>
            </div>
          )}

          {tab === 'sponsors' && (
            <div className="space-y-5">
              <form onSubmit={attachSponsor} className="hairline p-4 bg-surface/40 flex flex-col gap-2">
                <input className="bg-bg hairline px-3 py-2.5 text-ink text-sm"
                       placeholder="Sponsor-Name · z.B. TaylorMade"
                       value={sponsorForm.name}
                       onChange={(e) => setSponsorForm({...sponsorForm, name: e.target.value})} />
                <input className="bg-bg hairline px-3 py-2.5 text-ink text-sm"
                       placeholder="Website · https://…"
                       value={sponsorForm.website_url}
                       onChange={(e) => setSponsorForm({...sponsorForm, website_url: e.target.value})} />

                {sponsorForm.logo_url && (
                  <div className="hairline p-3 bg-bg flex items-center gap-3">
                    <img src={sponsorForm.logo_url} alt="" className="h-10 object-contain" />
                    <span className="text-[12px] text-inkMuted truncate flex-1">Logo bereit</span>
                  </div>
                )}
                <label className="block text-center py-2.5 hairline text-inkMuted text-[11px] tracking-[0.22em] uppercase cursor-pointer active:scale-[0.99]">
                  {busy ? '…' : 'Logo hochladen'}
                  <input type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" className="hidden"
                         onChange={handleSponsorLogoFile} disabled={busy} />
                </label>

                <button disabled={busy || !sponsorForm.name}
                        className="mt-1 py-2.5 bg-accent text-bg text-[11px] font-medium tracking-[0.24em] uppercase disabled:opacity-50">
                  {busy ? 'Saving…' : 'Powered by · attach'}
                </button>
              </form>

              <ul className="space-y-2">
                {placements.length === 0 && (
                  <li className="text-inkDim text-sm py-4 text-center">Noch keine Sponsoren.</li>
                )}
                {placements.map((p) => (
                  <li key={p.id} className="hairline p-3 bg-surface/40 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {p.sponsor?.logo_url && (
                        <img src={p.sponsor.logo_url} alt="" className="h-8 object-contain" />
                      )}
                      <div className="min-w-0">
                        <p className="text-ink text-[14px] truncate">{p.sponsor?.name}</p>
                        <p className="text-[10px] tracking-[0.22em] uppercase text-inkDim">
                          {p.placement_type.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => removeSponsor(p.id)}
                            className="text-inkDim hover:text-danger text-lg leading-none p-1">×</button>
                  </li>
                ))}
              </ul>

              <p className="text-[11px] text-inkDim text-center leading-relaxed">
                Sponsor erscheint dezent unten auf Invitational-Page + Recap als „Powered by".
              </p>
            </div>
          )}

        </div>
      </div>

      <QrCodeSheet open={qrOpen} onClose={() => setQrOpen(false)} cup={cup} />
    </div>
  )
}

const TEAM_COLOR_PRESETS = [
  '#5C9A6E', '#9BB5C9', '#D9A38E', '#D9C9A8', '#A8956A',
  '#7B9E89', '#C8A5BE', '#E5B86A', '#7E94B5', '#B58A6A',
]

function TeamsTab({ cup, busy, setBusy, onChanged }) {
  const [form, setForm] = useState({
    team_a_name:     cup.team_a_name || 'Team A',
    team_b_name:     cup.team_b_name || 'Team B',
    team_a_color:    cup.team_a_color || '#5C9A6E',
    team_b_color:    cup.team_b_color || '#D9A38E',
    team_a_logo_url: cup.team_a_logo_url || '',
    team_b_logo_url: cup.team_b_logo_url || '',
  })

  async function save() {
    setBusy(true)
    await supabase.from('tournaments').update({
      team_a_name:     form.team_a_name,
      team_b_name:     form.team_b_name,
      team_a_color:    form.team_a_color,
      team_b_color:    form.team_b_color,
      team_a_logo_url: form.team_a_logo_url || null,
      team_b_logo_url: form.team_b_logo_url || null,
    }).eq('id', cup.id)
    setBusy(false)
    onChanged?.()
  }

  async function uploadLogo(side, file) {
    if (!file) return
    setBusy(true)
    try {
      const ext = fileExt(file, { fallback: 'png' })
      const path = `${cup.id}/team-${side}-${Date.now()}.${ext}`
      const logoUrl = await uploadToBucket('cup-covers', path, file, { upsert: false, cacheControl: '3600', contentType: file.type })
      setForm((f) => ({ ...f, [`team_${side}_logo_url`]: logoUrl }))
    } catch (err) {
      console.error('[team-logo]', err)
      alert('Logo-Upload fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {['a', 'b'].map((side) => {
        const nameKey  = `team_${side}_name`
        const colorKey = `team_${side}_color`
        const logoKey  = `team_${side}_logo_url`
        return (
          <div key={side} className="hairline p-4 bg-surface/40 space-y-3">
            <p className="text-[9px] tracking-[0.36em] uppercase text-inkDim">
              Team {side === 'a' ? 'A' : 'B'}
            </p>
            <input className="w-full bg-bg hairline px-3 py-2.5 text-ink text-sm"
                   placeholder="Team-Name"
                   value={form[nameKey]}
                   onChange={(e) => setForm({ ...form, [nameKey]: e.target.value })} />

            {/* Color */}
            <div>
              <p className="text-[10px] tracking-[0.22em] uppercase text-inkMuted mb-2">Farbe</p>
              <div className="flex items-center gap-2 flex-wrap">
                {TEAM_COLOR_PRESETS.map((c) => (
                  <button key={c} type="button"
                    onClick={() => setForm({ ...form, [colorKey]: c })}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      form[colorKey] === c ? 'scale-110' : 'scale-100'
                    }`}
                    style={{
                      background: c,
                      boxShadow: form[colorKey] === c
                        ? '0 0 0 2px rgba(244,241,234,0.45), 0 0 0 1px rgba(0,0,0,0.6) inset'
                        : '0 0 0 1px rgba(244,241,234,0.12)',
                    }}
                    aria-label={c} />
                ))}
                <label className="text-[10px] tracking-[0.22em] uppercase text-inkMuted cursor-pointer flex items-center gap-1 ml-1">
                  <span>Custom</span>
                  <input type="color" value={form[colorKey]}
                         onChange={(e) => setForm({ ...form, [colorKey]: e.target.value })}
                         className="w-6 h-6 bg-transparent border-0 cursor-pointer" />
                </label>
              </div>
            </div>

            {/* Logo */}
            <div>
              <p className="text-[10px] tracking-[0.22em] uppercase text-inkMuted mb-2">Logo</p>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-card hairline flex items-center justify-center bg-bg flex-shrink-0 overflow-hidden">
                  {form[logoKey]
                    ? <img src={form[logoKey]} alt="" className="w-full h-full object-contain" />
                    : <span className="text-[10px] uppercase tracking-[0.22em]" style={{ color: form[colorKey] }}>
                        {(form[nameKey] || '?')[0]?.toUpperCase()}
                      </span>}
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="block text-center py-2 hairline text-inkMuted text-[10px] tracking-[0.22em] uppercase cursor-pointer">
                    {form[logoKey] ? 'Logo ersetzen' : 'Logo hochladen'}
                    <input type="file" accept="image/*" className="hidden"
                           onChange={(e) => uploadLogo(side, e.target.files?.[0])} />
                  </label>
                  {form[logoKey] && (
                    <button type="button" onClick={() => setForm({ ...form, [logoKey]: '' })}
                            className="text-[9px] tracking-[0.22em] uppercase text-inkDim hover:text-danger">
                      Entfernen
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      <button onClick={save} disabled={busy}
              className="w-full py-4 bg-accent text-brandDark text-[12px] font-medium tracking-[0.28em] uppercase active:scale-[0.99] transition-transform disabled:opacity-50">
        {busy ? 'Saving…' : 'Save Team Identity'}
      </button>
    </div>
  )
}
