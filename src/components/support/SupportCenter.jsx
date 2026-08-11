/**
 * SupportCenter (JSX build) — for plain JS/JSX apps (Swing & Savor, DealBuddy PWA).
 * Functionally identical to ui/SupportCenter.tsx. Keep both in sync.
 *
 * Usage: <SupportCenter supabase={supabase} appLabel="Swing & Savor" brandColor="#0ea5a4" />
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDateTime } from '../../lib/format';

const STATUS = {
  received:     { label: 'Eingegangen',    color: '#6b7280' },
  in_progress:  { label: 'In Bearbeitung',  color: '#2563eb' },
  waiting_user: { label: 'Wartet auf dich', color: '#d97706' },
  resolved:     { label: 'Gelöst',          color: '#16a34a' },
  closed:       { label: 'Geschlossen',     color: '#9ca3af' },
};

function StatusBadge({ status }) {
  const s = STATUS[status] ?? STATUS.received;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 12,
      fontWeight: 600, color: '#fff', background: s.color, whiteSpace: 'nowrap',
    }}>{s.label}</span>
  );
}

export default function SupportCenter({ supabase, appLabel, brandColor = '#2563eb', context }) {
  const [view, setView] = useState('list');
  const [tickets, setTickets] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const baseContext = useMemo(() => ({
    ...(context ?? {}),
    ...(typeof window !== 'undefined'
      ? { route: window.location?.pathname, ua: navigator?.userAgent }
      : {}),
  }), [context]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('support_tickets')
      .select('id,subject,status,last_activity_at,created_at')
      .order('last_activity_at', { ascending: false });
    if (error) setError('Konnte Anfragen nicht laden.');
    else { setTickets(data ?? []); setError(null); }
    setLoading(false);
  }, [supabase]);

  const loadMessages = useCallback(async (ticketId) => {
    const { data } = await supabase
      .from('support_ticket_messages')
      .select('id,author,body,created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    setMessages(data ?? []);
  }, [supabase]);

  useEffect(() => { queueMicrotask(() => { void loadTickets(); }); }, [loadTickets]);
  useEffect(() => {
    if (view !== 'detail' || !active) return;
    queueMicrotask(() => { void loadMessages(active.id); });
    const t = setInterval(() => { void loadMessages(active.id); }, 15000);
    return () => clearInterval(t);
  }, [view, active, loadMessages]);

  const openTicket = (t) => { setActive(t); setView('detail'); };

  const panel = { maxWidth: 640, margin: '0 auto', fontFamily: 'inherit', color: '#111827' };
  const card = { border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff', padding: 16, marginBottom: 12 };
  const btn = (filled = true) => ({
    border: filled ? 'none' : `1px solid ${brandColor}`,
    background: filled ? brandColor : 'transparent',
    color: filled ? '#fff' : brandColor,
    padding: '10px 16px', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 14,
  });
  const input = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
    border: '1px solid #d1d5db', fontSize: 14, fontFamily: 'inherit', marginTop: 6,
  };

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  async function submitNew(e) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setBusy(true); setError(null);
    const { data, error } = await supabase.functions.invoke('support-create', {
      body: { subject: subject.trim(), message: body.trim(), context: baseContext },
    });
    setBusy(false);
    if (error || !data?.id) { setError('Senden fehlgeschlagen. Bitte erneut versuchen.'); return; }
    setSubject(''); setBody('');
    await loadTickets();
    setView('list');
  }

  const [reply, setReply] = useState('');
  async function submitReply(e) {
    e.preventDefault();
    if (!active || !reply.trim()) return;
    setBusy(true); setError(null);
    const { error } = await supabase.functions.invoke('support-reply', {
      body: { ticket_id: active.id, message: reply.trim() },
    });
    setBusy(false);
    if (error) { setError('Senden fehlgeschlagen.'); return; }
    setReply('');
    await loadMessages(active.id);
    await loadTickets();
  }

  return (
    <div style={panel}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          {view === 'new' ? 'Neue Anfrage' : view === 'detail' ? (active?.subject ?? 'Anfrage') : 'Hilfe & Support'}
        </h2>
        {view === 'list'
          ? <button style={btn()} onClick={() => { setError(null); setView('new'); }}>Neue Anfrage</button>
          : <button style={btn(false)} onClick={() => { setError(null); setView('list'); loadTickets(); }}>Zurück</button>}
      </div>

      {error && (
        <div style={{ ...card, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{error}</div>
      )}

      {view === 'list' && (
        <>
          {loading && <div style={card}>Lädt…</div>}
          {!loading && tickets.length === 0 && (
            <div style={{ ...card, textAlign: 'center', color: '#6b7280' }}>
              Noch keine Anfragen. Stell uns deine Frage zu {appLabel} – wir kümmern uns drum.
            </div>
          )}
          {!loading && tickets.map((t) => (
            <button key={t.id} onClick={() => openTicket(t)}
              style={{ ...card, width: '100%', textAlign: 'left', cursor: 'pointer', display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{t.subject}</span>
                <StatusBadge status={t.status} />
              </div>
              <div style={{ color: '#6b7280', fontSize: 12, marginTop: 6 }}>Aktualisiert {formatDateTime(t.last_activity_at)}</div>
            </button>
          ))}
        </>
      )}

      {view === 'new' && (
        <form onSubmit={submitNew} style={card}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Betreff
            <input style={input} value={subject} maxLength={200}
              onChange={(e) => setSubject(e.target.value)} placeholder="Worum geht's?" required />
          </label>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginTop: 14 }}>Deine Nachricht
            <textarea style={{ ...input, minHeight: 130, resize: 'vertical' }} value={body} maxLength={5000}
              onChange={(e) => setBody(e.target.value)} placeholder="Beschreib dein Anliegen…" required />
          </label>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button type="submit" style={btn()} disabled={busy}>{busy ? 'Senden…' : 'Anfrage senden'}</button>
            <button type="button" style={btn(false)} onClick={() => setView('list')}>Abbrechen</button>
          </div>
        </form>
      )}

      {view === 'detail' && active && (
        <>
          <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#6b7280', fontSize: 13 }}>Erstellt {formatDateTime(active.created_at)}</span>
            <StatusBadge status={active.status} />
          </div>
          <div style={{ ...card }}>
            {messages.length === 0 && <div style={{ color: '#6b7280' }}>Lädt…</div>}
            {messages.map((m) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: m.author === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                <div style={{
                  maxWidth: '80%', padding: '10px 14px', borderRadius: 14, fontSize: 14, whiteSpace: 'pre-wrap',
                  background: m.author === 'user' ? brandColor : '#f3f4f6',
                  color: m.author === 'user' ? '#fff' : '#111827',
                }}>
                  <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>
                    {m.author === 'user' ? 'Du' : 'Support'} · {formatDateTime(m.created_at)}
                  </div>
                  {m.body}
                </div>
              </div>
            ))}
          </div>
          {active.status !== 'closed' && (
            <form onSubmit={submitReply} style={card}>
              <textarea style={{ ...input, minHeight: 80, marginTop: 0, resize: 'vertical' }} value={reply}
                maxLength={5000} onChange={(e) => setReply(e.target.value)} placeholder="Antwort schreiben…" />
              <div style={{ marginTop: 10 }}>
                <button type="submit" style={btn()} disabled={busy || !reply.trim()}>{busy ? 'Senden…' : 'Antworten'}</button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
