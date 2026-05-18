import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
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
  const [loading, setLoading] = useState(true)

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    load()
  }, [isAdmin])

  async function load() {
    setLoading(true)
    const [{ data: amb }, { data: ev }, { data: tt }] = await Promise.all([
      supabase.from('ambassadors').select('*').order('created_at', { ascending: false }),
      supabase.from('event_ambassadors').select('*, ambassador:ambassador_id(name), tournament:tournament_id(name,date,invite_code)').order('created_at', { ascending: false }),
      supabase.from('tournaments').select('id, name, date, status, owner_id, package_type, invite_code').order('date', { ascending: false }).limit(50),
    ])
    setAmbassadors(amb || [])
    setLedger(ev || [])
    setCups(tt || [])
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
      <div className="flex hairline-b">
        {[
          { id: 'overview',    label: 'Overview'   },
          { id: 'ambassadors', label: 'Ambassadors'},
          { id: 'ledger',      label: 'Ledger'     },
          { id: 'cups',        label: 'Cups'       },
        ].map((tIt) => (
          <button key={tIt.id} onClick={() => setTab(tIt.id)}
            className={`flex-1 py-4 text-[11px] tracking-[0.22em] uppercase transition-colors ${
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
