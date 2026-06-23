import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { fileExt } from '../lib/format'
import { uploadToBucket } from '../lib/storage'
import LoadingSpinner from '../components/LoadingSpinner'

const ADMIN_EMAIL = 'rainer.roloff@comms-connect.de'

const ROLE_RATES = {
  connector:          15,
  host_partner:       30,
  operating_partner:  50,
  renewal_passive:    15,
  renewal_active:     30,
}
const ROLE_LABELS = {
  connector:         'Connector',
  host_partner:      'Host Partner',
  operating_partner: 'Operating Partner',
  renewal_passive:   'Renewal · passiv',
  renewal_active:    'Renewal · aktiv',
}
const STATUS_LABELS = {
  draft:          'Draft',
  pending_review: 'In Review',
  approved:       'Approved',
  rejected:       'Rejected',
  paid:           'Paid',
}

const SAVOR_PARTNER_TYPES = {
  partner:    'Partner',
  club:       'Club',
  restaurant: 'Restaurant',
  travel_op:  'Travel Operator',
  brand:      'Brand',
  pro_shop:   'Pro Shop',
}
const SAVOR_PARTNER_STATUSES = {
  active:  'Active',
  paused:  'Paused',
  blocked: 'Blocked',
}
const SAVOR_CATEGORIES = {
  tee_times:   'Tee Times',
  experiences: 'Experiences',
  dining:      'Dining',
  apparel:     'Apparel',
  travel:      'Travel',
  equipment:   'Equipment',
}
const SAVOR_OFFER_STATUSES = {
  active:   'Active',
  sold_out: 'Sold Out',
  draft:    'Draft',
  archived: 'Archived',
}

async function uploadSavorImage(file, prefix) {
  if (!file) return null
  const ext = fileExt(file)
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`
  return uploadToBucket('savor-images', path, file, { contentType: file.type || undefined })
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between py-3 hairline-b">
      <span className="text-[10px] tracking-[0.32em] uppercase text-inkDim">{label}</span>
      <span className="font-display text-ink tabular-nums" style={{ fontSize: 22, fontWeight: 500 }}>{value}</span>
    </div>
  )
}

export default function AdminScreen() {
  const { user } = useAuth()
  const [tab, setTab] = useState('overview')
  const [ambassadors, setAmbassadors] = useState([])
  const [ledger, setLedger] = useState([])
  const [cups, setCups] = useState([])
  const [savorPartners, setSavorPartners] = useState([])
  const [savorOffers, setSavorOffers] = useState([])
  const [loading, setLoading] = useState(true)

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    load()
  }, [isAdmin])

  async function load() {
    setLoading(true)
    const [{ data: amb }, { data: ev }, { data: tt }, { data: sp }, { data: so }] = await Promise.all([
      supabase.from('ambassadors').select('*').order('created_at', { ascending: false }),
      supabase.from('event_ambassadors').select('*, ambassador:ambassador_id(name), tournament:tournament_id(name,date,invite_code)').order('created_at', { ascending: false }),
      supabase.from('tournaments').select('id, name, date, status, owner_id, package_type, invite_code').order('date', { ascending: false }).limit(50),
      supabase.from('savor_partners').select('*').order('created_at', { ascending: false }),
      supabase.from('savor_offers').select('*, partner:partner_id(id,name,slug)').order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
    ])
    setAmbassadors(amb || [])
    setLedger(ev || [])
    setCups(tt || [])
    setSavorPartners(sp || [])
    setSavorOffers(so || [])
    setLoading(false)
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg text-center px-6">
        <p className="text-inkMuted text-sm mb-4">Admin-Zugang erfordert Login.</p>
      </div>
    )
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg text-center px-6">
        <p className="font-display text-ink text-[32px] mb-3" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>
          Admin only.
        </p>
        <p className="text-inkMuted text-sm">Diese Sicht ist Rainer vorbehalten.</p>
        <Link to="/home" className="mt-6 text-accent text-sm font-medium tracking-[0.22em] uppercase">
          ← Clubhouse
        </Link>
      </div>
    )
  }
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-bg"><LoadingSpinner /></div>

  // KPIs
  const totalRevenue = ledger.reduce((s, r) => s + Number(r.revenue_gross || 0), 0)
  const totalContrib = ledger.reduce((s, r) => s + Number(r.operating_contribution || 0), 0)
  const totalCommission = ledger.reduce((s, r) => s + Number(r.commission_amount || 0), 0)
  const paidCommission  = ledger.filter((r) => r.approval_status === 'paid')
                                .reduce((s, r) => s + Number(r.commission_amount || 0), 0)

  function exportCsv() {
    const headers = [
      'ambassador','tournament','date','partner_role','commission_rate',
      'revenue_gross','direct_event_costs','operating_contribution',
      'commission_amount','approval_status','description'
    ]
    const rows = ledger.map((r) => [
      r.ambassador?.name || '',
      r.tournament?.name || '',
      r.tournament?.date || '',
      r.partner_role,
      r.commission_rate,
      r.revenue_gross,
      r.direct_event_costs,
      r.operating_contribution,
      r.commission_amount || 0,
      r.approval_status,
      (r.contribution_description || '').replace(/[\r\n,;]/g, ' '),
    ].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `swing-savor-ambassadors-${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a); a.click(); a.remove()
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      <header className="px-5 pt-8 pb-6 hairline-b">
        <p className="text-[10px] tracking-[0.42em] uppercase text-accent mb-2">Founder Cockpit</p>
        <h1 className="font-display text-ink leading-none"
            style={{ fontSize: 36, fontWeight: 500, letterSpacing: '-0.015em' }}>
          Admin
        </h1>
      </header>

      {/* Tabs */}
      <div className="flex hairline-b overflow-x-auto no-scrollbar">
        {[
          { id: 'overview',    label: 'Overview'   },
          { id: 'ambassadors', label: 'Ambassadors'},
          { id: 'ledger',      label: 'Ledger'     },
          { id: 'cups',        label: 'Cups'       },
          { id: 'savor_partners', label: 'Savor · Partners' },
          { id: 'savor_offers',   label: 'Savor · Offers'   },
        ].map((tIt) => (
          <button key={tIt.id} onClick={() => setTab(tIt.id)}
            className={`flex-1 min-w-[120px] py-4 text-[11px] tracking-[0.22em] uppercase transition-colors whitespace-nowrap ${
              tab === tIt.id ? 'text-accent border-b border-accent' : 'text-inkMuted'
            }`}>
            {tIt.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <section className="px-5 py-8 max-w-lg mx-auto">
          <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-3">Founder Stats</p>
          <div className="hairline px-5 py-2 bg-surface/40">
            <StatRow label="Cups Total"        value={cups.length} />
            <StatRow label="Active Cups"       value={cups.filter((c) => c.status === 'active').length} />
            <StatRow label="Premium Cups"      value={cups.filter((c) => c.package_type && c.package_type !== 'free').length} />
            <StatRow label="Ambassadors"       value={ambassadors.length} />
            <StatRow label="Active Partners"   value={ambassadors.filter((a) => a.status === 'active').length} />
            <StatRow label="Total Revenue"     value={`€ ${totalRevenue.toFixed(2)}`} />
            <StatRow label="Deckungsbeitrag"   value={`€ ${totalContrib.toFixed(2)}`} />
            <StatRow label="Commission Open"   value={`€ ${(totalCommission - paidCommission).toFixed(2)}`} />
            <StatRow label="Commission Paid"   value={`€ ${paidCommission.toFixed(2)}`} />
          </div>

          <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-3 mt-8">Savor Lifestyle</p>
          <div className="hairline px-5 py-2 bg-surface/40">
            <StatRow label="Partners"          value={savorPartners.length} />
            <StatRow label="Active Partners"   value={savorPartners.filter((p) => p.status === 'active').length} />
            <StatRow label="Offers"            value={savorOffers.length} />
            <StatRow label="Live Offers"       value={savorOffers.filter((o) => o.status === 'active').length} />
            <StatRow label="Highlighted"       value={savorOffers.filter((o) => o.highlight).length} />
          </div>
        </section>
      )}

      {tab === 'ambassadors' && (
        <AmbassadorTab list={ambassadors} onReload={load} />
      )}

      {tab === 'ledger' && (
        <LedgerTab list={ledger} cups={cups} ambassadors={ambassadors} onReload={load} onExport={exportCsv} />
      )}

      {tab === 'cups' && (
        <CupsTab cups={cups} />
      )}

      {tab === 'savor_partners' && (
        <SavorPartnersTab list={savorPartners} onReload={load} />
      )}

      {tab === 'savor_offers' && (
        <SavorOffersTab list={savorOffers} partners={savorPartners} onReload={load} />
      )}
    </div>
  )
}

function AmbassadorTab({ list, onReload }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', community_region: '', notes: '' })
  const [busy, setBusy] = useState(false)

  async function add(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setBusy(true)
    await supabase.from('ambassadors').insert({ ...form, status: 'active' })
    setBusy(false)
    setForm({ name: '', email: '', phone: '', community_region: '', notes: '' })
    onReload()
  }

  async function setStatus(id, status) {
    await supabase.from('ambassadors').update({ status }).eq('id', id)
    onReload()
  }

  return (
    <section className="px-5 py-8 max-w-lg mx-auto">
      <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-3">New Ambassador</p>
      <form onSubmit={add} className="hairline p-5 bg-surface/40 flex flex-col gap-2 mb-8">
        <input placeholder="Name" value={form.name}
               onChange={(e) => setForm({...form, name: e.target.value})}
               className="bg-bg hairline px-3 py-2.5 text-ink text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Email" value={form.email}
                 onChange={(e) => setForm({...form, email: e.target.value})}
                 className="bg-bg hairline px-3 py-2.5 text-ink text-sm" />
          <input placeholder="Phone" value={form.phone}
                 onChange={(e) => setForm({...form, phone: e.target.value})}
                 className="bg-bg hairline px-3 py-2.5 text-ink text-sm" />
        </div>
        <input placeholder="Region / Golf-Umfeld" value={form.community_region}
               onChange={(e) => setForm({...form, community_region: e.target.value})}
               className="bg-bg hairline px-3 py-2.5 text-ink text-sm" />
        <textarea placeholder="Notes (intern)" value={form.notes} rows={2}
               onChange={(e) => setForm({...form, notes: e.target.value})}
               className="bg-bg hairline px-3 py-2.5 text-ink text-sm" />
        <button disabled={busy}
                className="mt-2 py-3 bg-accent text-bg text-[12px] font-medium tracking-[0.24em] uppercase disabled:opacity-50">
          {busy ? 'Saving…' : 'Add Ambassador'}
        </button>
      </form>

      <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-3">Directory</p>
      <ul className="space-y-2">
        {list.map((a) => (
          <li key={a.id} className="hairline p-4 bg-surface/40">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1 pr-4">
                <p className="font-display text-ink text-[18px]" style={{ fontWeight: 500 }}>{a.name}</p>
                <p className="text-[11px] text-inkMuted truncate">
                  {[a.email, a.phone, a.community_region].filter(Boolean).join('  ·  ')}
                </p>
                {a.notes && <p className="text-[11px] text-inkDim mt-1.5 leading-relaxed">{a.notes}</p>}
              </div>
              <select value={a.status}
                      onChange={(e) => setStatus(a.id, e.target.value)}
                      className="bg-bg hairline px-2 py-1.5 text-[11px] text-ink uppercase tracking-wider">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </li>
        ))}
        {list.length === 0 && <li className="text-inkDim text-sm">Keine Ambassadors angelegt.</li>}
      </ul>
    </section>
  )
}

function LedgerTab({ list, cups, ambassadors, onReload, onExport }) {
  const [form, setForm] = useState({
    tournament_id: '',
    ambassador_id: '',
    partner_role: 'connector',
    revenue_gross: '',
    direct_event_costs: '',
    contribution_description: '',
  })
  const [busy, setBusy] = useState(false)

  async function add(e) {
    e.preventDefault()
    if (!form.tournament_id || !form.ambassador_id) return
    setBusy(true)
    const rate = ROLE_RATES[form.partner_role]
    await supabase.from('event_ambassadors').insert({
      tournament_id: form.tournament_id,
      ambassador_id: form.ambassador_id,
      partner_role:  form.partner_role,
      commission_rate: rate,
      revenue_gross: parseFloat(form.revenue_gross) || 0,
      direct_event_costs: parseFloat(form.direct_event_costs) || 0,
      contribution_description: form.contribution_description || null,
      approval_status: 'draft',
    })
    setBusy(false)
    setForm({ tournament_id: '', ambassador_id: '', partner_role: 'connector', revenue_gross: '', direct_event_costs: '', contribution_description: '' })
    onReload()
  }

  async function setStatus(id, status) {
    const patch = { approval_status: status }
    if (status === 'paid') patch.paid_at = new Date().toISOString()
    if (status === 'approved' || status === 'rejected') patch.approved_at = new Date().toISOString()
    await supabase.from('event_ambassadors').update(patch).eq('id', id)
    onReload()
  }

  return (
    <section className="px-5 py-8 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted">Commission Ledger</p>
        <button onClick={onExport}
                className="text-[10px] tracking-[0.22em] uppercase text-accent hover:text-accentDeep">
          ⇣ Export CSV
        </button>
      </div>

      <form onSubmit={add} className="hairline p-5 bg-surface/40 flex flex-col gap-2 mb-8">
        <select value={form.tournament_id}
                onChange={(e) => setForm({...form, tournament_id: e.target.value})}
                className="bg-bg hairline px-3 py-2.5 text-ink text-sm">
          <option value="">Cup wählen…</option>
          {cups.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.date}</option>)}
        </select>
        <select value={form.ambassador_id}
                onChange={(e) => setForm({...form, ambassador_id: e.target.value})}
                className="bg-bg hairline px-3 py-2.5 text-ink text-sm">
          <option value="">Ambassador wählen…</option>
          {ambassadors.filter((a) => a.status === 'active')
                      .map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={form.partner_role}
                onChange={(e) => setForm({...form, partner_role: e.target.value})}
                className="bg-bg hairline px-3 py-2.5 text-ink text-sm">
          {Object.entries(ROLE_LABELS).map(([id, label]) =>
            <option key={id} value={id}>{label} · {ROLE_RATES[id]} %</option>
          )}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" step="0.01" placeholder="Revenue gross €" value={form.revenue_gross}
                 onChange={(e) => setForm({...form, revenue_gross: e.target.value})}
                 className="bg-bg hairline px-3 py-2.5 text-ink text-sm tabular-nums" />
          <input type="number" step="0.01" placeholder="Direct costs €" value={form.direct_event_costs}
                 onChange={(e) => setForm({...form, direct_event_costs: e.target.value})}
                 className="bg-bg hairline px-3 py-2.5 text-ink text-sm tabular-nums" />
        </div>
        <textarea placeholder="Partner-Leistung (aktiv)" value={form.contribution_description} rows={2}
               onChange={(e) => setForm({...form, contribution_description: e.target.value})}
               className="bg-bg hairline px-3 py-2.5 text-ink text-sm" />
        <button disabled={busy}
                className="mt-2 py-3 bg-accent text-bg text-[12px] font-medium tracking-[0.24em] uppercase disabled:opacity-50">
          {busy ? 'Saving…' : 'Add Ledger Entry'}
        </button>
      </form>

      <ul className="space-y-2">
        {list.map((r) => (
          <li key={r.id} className="hairline p-4 bg-surface/40">
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0 flex-1 pr-3">
                <p className="font-display text-ink text-[18px]" style={{ fontWeight: 500 }}>
                  {r.ambassador?.name} · {ROLE_LABELS[r.partner_role]}
                </p>
                <p className="text-[11px] text-inkMuted">
                  {r.tournament?.name} · {r.tournament?.date}
                </p>
              </div>
              <select value={r.approval_status}
                      onChange={(e) => setStatus(r.id, e.target.value)}
                      className="bg-bg hairline px-2 py-1.5 text-[11px] text-ink uppercase tracking-wider">
                {Object.entries(STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center mt-2 hairline-t pt-3">
              <div>
                <p className="text-[9px] tracking-[0.24em] uppercase text-inkDim">Revenue</p>
                <p className="text-[14px] text-ink tabular-nums mt-0.5">€ {Number(r.revenue_gross || 0).toFixed(0)}</p>
              </div>
              <div>
                <p className="text-[9px] tracking-[0.24em] uppercase text-inkDim">Costs</p>
                <p className="text-[14px] text-ink tabular-nums mt-0.5">€ {Number(r.direct_event_costs || 0).toFixed(0)}</p>
              </div>
              <div>
                <p className="text-[9px] tracking-[0.24em] uppercase text-inkDim">Contrib.</p>
                <p className="text-[14px] text-ink tabular-nums mt-0.5">€ {Number(r.operating_contribution || 0).toFixed(0)}</p>
              </div>
              <div>
                <p className="text-[9px] tracking-[0.24em] uppercase text-accent">Comm.</p>
                <p className="text-[14px] text-accent tabular-nums mt-0.5">€ {Number(r.commission_amount || 0).toFixed(0)}</p>
              </div>
            </div>
            {r.contribution_description && (
              <p className="text-[11px] text-inkDim mt-2 leading-relaxed">{r.contribution_description}</p>
            )}
          </li>
        ))}
        {list.length === 0 && <li className="text-inkDim text-sm">Keine Ledger-Einträge.</li>}
      </ul>
    </section>
  )
}

function CupsTab({ cups }) {
  return (
    <section className="px-5 py-8 max-w-lg mx-auto">
      <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-3">Cups (Last 50)</p>
      <ul className="hairline divide-y divide-[rgba(244,241,234,0.08)] bg-surface/40">
        {cups.map((c) => (
          <li key={c.id} className="px-4 py-3 flex items-center justify-between">
            <div className="min-w-0 flex-1 pr-3">
              <p className="text-ink text-[14px] truncate">{c.name}</p>
              <p className="text-[11px] text-inkDim tracking-wider">{c.date} · #{c.invite_code}</p>
            </div>
            <span className={`text-[10px] tracking-[0.22em] uppercase px-2 py-1 ${
              c.package_type && c.package_type !== 'free'
                ? 'text-accent bg-accent/10'
                : 'text-inkDim'
            }`}>
              {c.package_type && c.package_type !== 'free' ? c.package_type : 'free'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ─── Savor Partners ────────────────────────────────────────────────────────────

const EMPTY_PARTNER = {
  id: null, name: '', type: 'partner', city: '', country_code: 'DE',
  website_url: '', contact_email: '', description: '', logo_url: '',
}

function SavorPartnersTab({ list, onReload }) {
  const [draft, setDraft] = useState(EMPTY_PARTNER)
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState('')
  const editing = !!draft.id

  function startEdit(p) {
    setErr('')
    setDraft({
      id: p.id, name: p.name || '', type: p.type || 'partner',
      city: p.city || '', country_code: p.country_code || 'DE',
      website_url: p.website_url || '', contact_email: p.contact_email || '',
      description: p.description || '', logo_url: p.logo_url || '',
    })
  }

  async function save(e) {
    e.preventDefault()
    if (!draft.name.trim()) return
    setBusy(true); setErr('')
    try {
      const payload = {
        name: draft.name.trim(),
        type: draft.type,
        city: draft.city || null,
        country_code: draft.country_code || null,
        website_url: draft.website_url || null,
        contact_email: draft.contact_email || null,
        description: draft.description || null,
        logo_url: draft.logo_url || null,
      }
      const { error } = editing
        ? await supabase.from('savor_partners').update(payload).eq('id', draft.id)
        : await supabase.from('savor_partners').insert({ ...payload, status: 'active' })
      if (error) throw error
      setDraft(EMPTY_PARTNER)
      await onReload()
    } catch (ex) {
      setErr(ex.message || 'Speichern fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(id, status) {
    await supabase.from('savor_partners').update({ status }).eq('id', id)
    onReload()
  }

  async function onLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setErr('')
    try {
      const url = await uploadSavorImage(file, 'partners')
      setDraft((d) => ({ ...d, logo_url: url }))
    } catch (ex) {
      setErr(ex.message || 'Upload fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="px-5 py-8 max-w-lg mx-auto">
      <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-3">
        {editing ? 'Edit Partner' : 'New Partner'}
      </p>
      <form onSubmit={save} className="hairline p-5 bg-surface/40 flex flex-col gap-2 mb-8">
        <input placeholder="Name" value={draft.name}
               onChange={(e) => setDraft({ ...draft, name: e.target.value })}
               className="bg-bg hairline px-3 py-2.5 text-ink text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <select value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                  className="bg-bg hairline px-3 py-2.5 text-ink text-sm">
            {Object.entries(SAVOR_PARTNER_TYPES).map(([k, v]) =>
              <option key={k} value={k}>{v}</option>
            )}
          </select>
          <input placeholder="City" value={draft.city}
                 onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                 className="bg-bg hairline px-3 py-2.5 text-ink text-sm" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input placeholder="DE" maxLength={2} value={draft.country_code}
                 onChange={(e) => setDraft({ ...draft, country_code: e.target.value.toUpperCase() })}
                 className="bg-bg hairline px-3 py-2.5 text-ink text-sm uppercase tracking-wider" />
          <input placeholder="Contact email" type="email" value={draft.contact_email}
                 onChange={(e) => setDraft({ ...draft, contact_email: e.target.value })}
                 className="col-span-2 bg-bg hairline px-3 py-2.5 text-ink text-sm" />
        </div>
        <input placeholder="Website URL" value={draft.website_url}
               onChange={(e) => setDraft({ ...draft, website_url: e.target.value })}
               className="bg-bg hairline px-3 py-2.5 text-ink text-sm" />
        <textarea placeholder="Description" value={draft.description} rows={3}
               onChange={(e) => setDraft({ ...draft, description: e.target.value })}
               className="bg-bg hairline px-3 py-2.5 text-ink text-sm" />

        <div className="flex items-center gap-3 mt-1">
          {draft.logo_url
            ? <img src={draft.logo_url} alt="" className="w-14 h-14 object-cover hairline" />
            : <div className="w-14 h-14 hairline flex items-center justify-center text-inkDim text-xs">Logo</div>
          }
          <label className="flex-1 hairline px-3 py-2.5 text-inkMuted text-[11px] tracking-[0.18em] uppercase cursor-pointer text-center">
            {draft.logo_url ? 'Logo ersetzen' : 'Logo wählen'}
            <input type="file" accept="image/*" onChange={onLogoChange} className="hidden" />
          </label>
          {draft.logo_url && (
            <button type="button" onClick={() => setDraft({ ...draft, logo_url: '' })}
                    className="text-[11px] tracking-[0.18em] uppercase text-inkDim hover:text-ink">
              ×
            </button>
          )}
        </div>

        {err && <p className="text-[11px] text-red-400 leading-snug">{err}</p>}

        <div className="flex gap-2 mt-2">
          {editing && (
            <button type="button" onClick={() => setDraft(EMPTY_PARTNER)}
                    className="flex-1 py-3 hairline text-inkMuted text-[12px] tracking-[0.24em] uppercase">
              Cancel
            </button>
          )}
          <button disabled={busy}
                  className="flex-1 py-3 bg-accent text-bg text-[12px] font-medium tracking-[0.24em] uppercase disabled:opacity-50">
            {busy ? 'Saving…' : editing ? 'Update Partner' : 'Add Partner'}
          </button>
        </div>
      </form>

      <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-3">
        Directory ({list.length})
      </p>
      <ul className="space-y-2">
        {list.map((p) => (
          <li key={p.id} className="hairline p-4 bg-surface/40">
            <div className="flex items-start gap-3">
              {p.logo_url
                ? <img src={p.logo_url} alt="" className="w-12 h-12 object-cover hairline flex-shrink-0" />
                : <div className="w-12 h-12 hairline flex items-center justify-center text-inkDim text-[10px] flex-shrink-0">
                    {SAVOR_PARTNER_TYPES[p.type]?.[0] || 'P'}
                  </div>
              }
              <div className="min-w-0 flex-1">
                <p className="font-display text-ink text-[18px]" style={{ fontWeight: 500 }}>{p.name}</p>
                <p className="text-[10px] tracking-[0.22em] uppercase text-inkDim">
                  {SAVOR_PARTNER_TYPES[p.type] || p.type}
                  {p.city && ` · ${p.city}`}
                  {p.country_code && ` · ${p.country_code}`}
                </p>
                <p className="text-[11px] text-inkMuted truncate mt-1">
                  {[p.website_url, p.contact_email].filter(Boolean).join('  ·  ')}
                </p>
              </div>
              <select value={p.status}
                      onChange={(e) => setStatus(p.id, e.target.value)}
                      className="bg-bg hairline px-2 py-1.5 text-[11px] text-ink uppercase tracking-wider">
                {Object.entries(SAVOR_PARTNER_STATUSES).map(([k, v]) =>
                  <option key={k} value={k}>{v}</option>
                )}
              </select>
            </div>
            <div className="flex items-center justify-between mt-3 hairline-t pt-2">
              <p className="text-[10px] tracking-[0.18em] uppercase text-inkDim">
                slug · {p.slug || '—'}
              </p>
              <button onClick={() => startEdit(p)}
                      className="text-[10px] tracking-[0.22em] uppercase text-accent hover:text-accentDeep">
                Edit ↗
              </button>
            </div>
          </li>
        ))}
        {list.length === 0 && <li className="text-inkDim text-sm">Keine Partner angelegt.</li>}
      </ul>
    </section>
  )
}

// ─── Savor Offers ──────────────────────────────────────────────────────────────

const EMPTY_OFFER = {
  id: null, category: 'tee_times', title: '', subtitle: '', description: '',
  image_url: '', city: '', country_code: 'DE', partner_id: '',
  price_eur_cents: '', price_label: '', external_url: '',
  available_from: '', available_until: '', tee_time_at: '',
  highlight: false, badge: '', sort_order: 0,
}

function toLocalInputValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function SavorOffersTab({ list, partners, onReload }) {
  const [draft, setDraft] = useState(EMPTY_OFFER)
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const editing = !!draft.id

  function startEdit(o) {
    setErr('')
    setDraft({
      id: o.id, category: o.category, title: o.title || '',
      subtitle: o.subtitle || '', description: o.description || '',
      image_url: o.image_url || '', city: o.city || '',
      country_code: o.country_code || 'DE',
      partner_id: o.partner_id || '',
      price_eur_cents: o.price_eur_cents ?? '',
      price_label: o.price_label || '',
      external_url: o.external_url || '',
      available_from:  o.available_from  || '',
      available_until: o.available_until || '',
      tee_time_at: toLocalInputValue(o.tee_time_at),
      highlight: !!o.highlight, badge: o.badge || '',
      sort_order: o.sort_order ?? 0,
    })
  }

  async function save(e) {
    e.preventDefault()
    if (!draft.title.trim()) return
    setBusy(true); setErr('')
    try {
      const payload = {
        category: draft.category,
        title: draft.title.trim(),
        subtitle: draft.subtitle || null,
        description: draft.description || null,
        image_url: draft.image_url || null,
        city: draft.city || null,
        country_code: draft.country_code || null,
        partner_id: draft.partner_id || null,
        price_eur_cents: draft.price_eur_cents === '' ? null : Math.round(Number(draft.price_eur_cents)),
        price_label: draft.price_label || null,
        external_url: draft.external_url || null,
        available_from:  draft.available_from  || null,
        available_until: draft.available_until || null,
        tee_time_at: draft.tee_time_at ? new Date(draft.tee_time_at).toISOString() : null,
        highlight: !!draft.highlight,
        badge: draft.badge || null,
        sort_order: Number(draft.sort_order) || 0,
      }
      const { error } = editing
        ? await supabase.from('savor_offers').update(payload).eq('id', draft.id)
        : await supabase.from('savor_offers').insert({ ...payload, status: 'active' })
      if (error) throw error
      setDraft(EMPTY_OFFER)
      await onReload()
    } catch (ex) {
      setErr(ex.message || 'Speichern fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(id, status) {
    await supabase.from('savor_offers').update({ status }).eq('id', id)
    onReload()
  }

  async function onImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setErr('')
    try {
      const url = await uploadSavorImage(file, 'offers')
      setDraft((d) => ({ ...d, image_url: url }))
    } catch (ex) {
      setErr(ex.message || 'Upload fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  const filtered = filterCat === 'all' ? list : list.filter((o) => o.category === filterCat)
  const activePartners = partners.filter((p) => p.status === 'active')

  return (
    <section className="px-5 py-8 max-w-lg mx-auto">
      <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-3">
        {editing ? 'Edit Offer' : 'New Offer'}
      </p>
      <form onSubmit={save} className="hairline p-5 bg-surface/40 flex flex-col gap-2 mb-8">
        <div className="grid grid-cols-2 gap-2">
          <select value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className="bg-bg hairline px-3 py-2.5 text-ink text-sm">
            {Object.entries(SAVOR_CATEGORIES).map(([k, v]) =>
              <option key={k} value={k}>{v}</option>
            )}
          </select>
          <select value={draft.partner_id}
                  onChange={(e) => setDraft({ ...draft, partner_id: e.target.value })}
                  className="bg-bg hairline px-3 py-2.5 text-ink text-sm">
            <option value="">Partner (optional)…</option>
            {activePartners.map((p) =>
              <option key={p.id} value={p.id}>{p.name}</option>
            )}
          </select>
        </div>

        <input placeholder="Title" value={draft.title}
               onChange={(e) => setDraft({ ...draft, title: e.target.value })}
               className="bg-bg hairline px-3 py-2.5 text-ink text-sm" />
        <input placeholder="Subtitle (kurz)" value={draft.subtitle}
               onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
               className="bg-bg hairline px-3 py-2.5 text-ink text-sm" />
        <textarea placeholder="Description" value={draft.description} rows={4}
               onChange={(e) => setDraft({ ...draft, description: e.target.value })}
               className="bg-bg hairline px-3 py-2.5 text-ink text-sm" />

        <div className="flex items-center gap-3 mt-1">
          {draft.image_url
            ? <img src={draft.image_url} alt="" className="w-20 h-24 object-cover hairline" />
            : <div className="w-20 h-24 hairline flex items-center justify-center text-inkDim text-xs">Cover</div>
          }
          <label className="flex-1 hairline px-3 py-2.5 text-inkMuted text-[11px] tracking-[0.18em] uppercase cursor-pointer text-center">
            {draft.image_url ? 'Cover ersetzen' : 'Cover wählen (4:5)'}
            <input type="file" accept="image/*" onChange={onImageChange} className="hidden" />
          </label>
          {draft.image_url && (
            <button type="button" onClick={() => setDraft({ ...draft, image_url: '' })}
                    className="text-[11px] tracking-[0.18em] uppercase text-inkDim hover:text-ink">
              ×
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-1">
          <input placeholder="City" value={draft.city}
                 onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                 className="col-span-2 bg-bg hairline px-3 py-2.5 text-ink text-sm" />
          <input placeholder="DE" maxLength={2} value={draft.country_code}
                 onChange={(e) => setDraft({ ...draft, country_code: e.target.value.toUpperCase() })}
                 className="bg-bg hairline px-3 py-2.5 text-ink text-sm uppercase tracking-wider" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input type="number" min="0" step="100" placeholder="Preis (Cent, z.B. 7900)" value={draft.price_eur_cents}
                 onChange={(e) => setDraft({ ...draft, price_eur_cents: e.target.value })}
                 className="bg-bg hairline px-3 py-2.5 text-ink text-sm tabular-nums" />
          <input placeholder={'Label „ab 79 €"'} value={draft.price_label}
                 onChange={(e) => setDraft({ ...draft, price_label: e.target.value })}
                 className="bg-bg hairline px-3 py-2.5 text-ink text-sm" />
        </div>

        <input placeholder="Booking-URL (Partner-Deeplink)" value={draft.external_url}
               onChange={(e) => setDraft({ ...draft, external_url: e.target.value })}
               className="bg-bg hairline px-3 py-2.5 text-ink text-sm" />

        <div className="grid grid-cols-2 gap-2">
          <label className="bg-bg hairline px-3 py-2 text-[10px] tracking-[0.22em] uppercase text-inkDim flex flex-col gap-1">
            Verfügbar ab
            <input type="date" value={draft.available_from}
                   onChange={(e) => setDraft({ ...draft, available_from: e.target.value })}
                   className="bg-transparent text-ink text-sm" />
          </label>
          <label className="bg-bg hairline px-3 py-2 text-[10px] tracking-[0.22em] uppercase text-inkDim flex flex-col gap-1">
            Verfügbar bis
            <input type="date" value={draft.available_until}
                   onChange={(e) => setDraft({ ...draft, available_until: e.target.value })}
                   className="bg-transparent text-ink text-sm" />
          </label>
        </div>

        {draft.category === 'tee_times' && (
          <label className="bg-bg hairline px-3 py-2 text-[10px] tracking-[0.22em] uppercase text-inkDim flex flex-col gap-1">
            Tee Time
            <input type="datetime-local" value={draft.tee_time_at}
                   onChange={(e) => setDraft({ ...draft, tee_time_at: e.target.value })}
                   className="bg-transparent text-ink text-sm" />
          </label>
        )}

        <div className="grid grid-cols-3 gap-2 mt-1">
          <input placeholder="Badge (z.B. Members only)" value={draft.badge}
                 onChange={(e) => setDraft({ ...draft, badge: e.target.value })}
                 className="col-span-2 bg-bg hairline px-3 py-2.5 text-ink text-sm" />
          <input type="number" placeholder="Sort" value={draft.sort_order}
                 onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })}
                 className="bg-bg hairline px-3 py-2.5 text-ink text-sm tabular-nums" />
        </div>

        <label className="flex items-center gap-2 mt-1 text-[12px] text-inkMuted">
          <input type="checkbox" checked={draft.highlight}
                 onChange={(e) => setDraft({ ...draft, highlight: e.target.checked })} />
          Featured auf Savor-Home
        </label>

        {err && <p className="text-[11px] text-red-400 leading-snug">{err}</p>}

        <div className="flex gap-2 mt-2">
          {editing && (
            <button type="button" onClick={() => setDraft(EMPTY_OFFER)}
                    className="flex-1 py-3 hairline text-inkMuted text-[12px] tracking-[0.24em] uppercase">
              Cancel
            </button>
          )}
          <button disabled={busy}
                  className="flex-1 py-3 bg-accent text-bg text-[12px] font-medium tracking-[0.24em] uppercase disabled:opacity-50">
            {busy ? 'Saving…' : editing ? 'Update Offer' : 'Add Offer'}
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted">
          Catalog ({filtered.length})
        </p>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
                className="bg-bg hairline px-2 py-1.5 text-[11px] text-ink uppercase tracking-wider">
          <option value="all">All Categories</option>
          {Object.entries(SAVOR_CATEGORIES).map(([k, v]) =>
            <option key={k} value={k}>{v}</option>
          )}
        </select>
      </div>

      <ul className="space-y-2">
        {filtered.map((o) => (
          <li key={o.id} className="hairline p-4 bg-surface/40">
            <div className="flex items-start gap-3">
              {o.image_url
                ? <img src={o.image_url} alt="" className="w-16 h-20 object-cover hairline flex-shrink-0" />
                : <div className="w-16 h-20 hairline flex items-center justify-center text-inkDim text-[10px] flex-shrink-0">·</div>
              }
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] tracking-[0.3em] uppercase text-accent">
                    {SAVOR_CATEGORIES[o.category]}
                  </span>
                  {o.highlight && <span className="text-[9px] tracking-[0.3em] uppercase text-accent">★ Featured</span>}
                </div>
                <p className="font-display text-ink text-[17px] leading-tight" style={{ fontWeight: 500 }}>
                  {o.title}
                </p>
                {o.subtitle && <p className="text-[11px] text-inkMuted truncate mt-0.5">{o.subtitle}</p>}
                <p className="text-[10px] tracking-[0.18em] uppercase text-inkDim mt-1">
                  {[
                    o.partner?.name,
                    o.city,
                    o.price_label || (o.price_eur_cents ? `${(o.price_eur_cents/100).toFixed(0)} €` : null),
                    `slug ${o.slug || '—'}`,
                  ].filter(Boolean).join('  ·  ')}
                </p>
              </div>
              <select value={o.status}
                      onChange={(e) => setStatus(o.id, e.target.value)}
                      className="bg-bg hairline px-2 py-1.5 text-[11px] text-ink uppercase tracking-wider">
                {Object.entries(SAVOR_OFFER_STATUSES).map(([k, v]) =>
                  <option key={k} value={k}>{v}</option>
                )}
              </select>
            </div>
            <div className="flex items-center justify-end mt-3 hairline-t pt-2">
              <button onClick={() => startEdit(o)}
                      className="text-[10px] tracking-[0.22em] uppercase text-accent hover:text-accentDeep">
                Edit ↗
              </button>
            </div>
          </li>
        ))}
        {filtered.length === 0 && <li className="text-inkDim text-sm">Keine Offers in dieser Kategorie.</li>}
      </ul>
    </section>
  )
}
