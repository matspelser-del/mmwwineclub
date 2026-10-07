'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { rand, shortDate } from '@/lib/format';

// Payfast card-update base. The exact URL isn't published, so this is configurable
// and must be verified in sandbox before relying on it.
const CARD_BASE = process.env.NEXT_PUBLIC_PAYFAST_CARD_UPDATE_BASE || 'https://www.payfast.co.za/eng/recurring/update';

function Badge({ v }) {
  const map = { active:'green', paused:'amber', cancelled:'grey', pending:'blue' };
  return <span className={`badge ${map[v]||'grey'}`}><span className="dot" />{v}</span>;
}
const BLANK = { email:'', name:'', phone:'', tier:'club', seats:1, status:'active',
  payfast_token:'', addr_line1:'', addr_line2:'', city:'', province:'', postal_code:'', country:'South Africa', notes:'' };

export default function AdminHome() {
  const [token, setToken] = useState(null);
  const [data, setData] = useState({ members: [], payments: [], events: [] });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // member object, {} for new, or null
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token; setToken(t);
    const res = await fetch('/api/admin/members', { headers: { Authorization: `Bearer ${t}` } });
    const j = await res.json();
    setData(j); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const members = data.members || [];
  const active = members.filter((m) => m.status === 'active');
  const paused = members.filter((m) => m.status === 'paused');
  const revenue = (data.payments || []).filter((p) => p.status === 'complete').reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingReq = (data.events || []).filter((e) => e.outcome === 'pending' || e.outcome === 'no_token');

  const filtered = useMemo(() => members.filter((m) =>
    `${m.name} ${m.email} ${m.city||''} ${m.discount_code||''}`.toLowerCase().includes(q.toLowerCase())
  ), [members, q]);

  function openNew() { setForm({ ...BLANK }); setEditing({}); setMsg(''); }
  function openEdit(m) { setForm({ ...BLANK, ...Object.fromEntries(Object.keys(BLANK).map((k)=>[k, m[k] ?? BLANK[k]])) }); setEditing(m); setMsg(''); }
  const set = (k,v) => setForm((f)=>({ ...f, [k]: v }));

  async function save() {
    setSaving(true); setMsg('');
    const isNew = !editing.id;
    const res = await fetch('/api/admin/members', {
      method: isNew ? 'POST' : 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' },
      body: JSON.stringify(isNew ? form : { id: editing.id, ...form }),
    });
    setSaving(false);
    if (res.ok) { setEditing(null); load(); } else { const j = await res.json().catch(()=>({})); setMsg(j.error || 'Could not save'); }
  }
  async function removeMember() {
    if (!confirm(`Remove ${form.name}? This cannot be undone.`)) return;
    await fetch(`/api/admin/members?id=${editing.id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } });
    setEditing(null); load();
  }
  async function subAction(action) {
    if (!confirm(`${action === 'resume' ? 'Resume' : action[0].toUpperCase()+action.slice(1)} this subscription in Payfast?`)) return;
    const res = await fetch('/api/admin/subscription', { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ memberId: editing.id, action }) });
    const j = await res.json();
    if (j.outcome === 'done') { setMsg(`Subscription ${action === 'resume' ? 'resumed' : action+'d'}.`); setForm((f)=>({ ...f, status: j.status })); load(); }
    else if (j.outcome === 'no_token') setMsg('No Payfast token saved for this member, add it first, then try again.');
    else setMsg('Payfast did not confirm. Logged as a pending request, action it in Payfast if needed.');
  }
  function copy(text, label) { navigator.clipboard?.writeText(text); setMsg(`${label} copied.`); }

  const portalUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const cardLink = form.payfast_token ? `${CARD_BASE}/${form.payfast_token}` : '';

  if (loading) return <div className="head"><p className="empty">Loading…</p></div>;

  return (
    <>
      <div className="head" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div><h1>Subscriptions</h1><p>{members.length} members · {active.length} active</p></div>
        <button className="btn" onClick={openNew}>+ Add member</button>
      </div>

      <div className="stats">
        <div className="stat"><div className="l">Active members</div><div className="v">{active.length}</div></div>
        <div className="stat"><div className="l">Paused</div><div className="v">{paused.length}</div></div>
        <div className="stat"><div className="l">Payments received</div><div className="v">{rand(revenue)}</div></div>
        <div className="stat"><div className="l">Requests to action</div><div className="v">{pendingReq.length}</div></div>
      </div>

      <input className="input search" placeholder="Search name, email, town, code…" value={q} onChange={(e)=>setQ(e.target.value)} />

      <div className="card">
        <div className="rowh"><div>Member</div><div>Delivery address</div><div>Tier</div><div>Status</div><div>Started · code</div></div>
        {filtered.length === 0 ? <div className="empty">No members yet.</div> :
          filtered.map((m) => (
            <div className="row" key={m.id} style={{ cursor:'pointer' }} onClick={()=>openEdit(m)}>
              <div><div className="nm">{m.name}</div><div className="sub">{m.email}</div></div>
              <div className="sub">{m.addr_line1 ? `${m.addr_line1}${m.addr_line2?', '+m.addr_line2:''}, ${m.city||''} ${m.postal_code||''}` : '— not provided —'}</div>
              <div><span className={`badge ${m.tier==='lunch'?'red':'blue'}`}><span className="dot" />{m.tier==='lunch'?`Lunch ×${m.seats||1}`:'Club'}</span></div>
              <div><Badge v={m.status} /></div>
              <div className="sub">{shortDate(m.start_date)}<br/>{m.discount_code ? <span className="code">{m.discount_code}</span> : ''}</div>
            </div>
          ))}
      </div>

      {editing && (
        <div className="pf-overlay open" onMouseDown={()=>setEditing(null)}>
          <div className="pf-modal light" onMouseDown={(e)=>e.stopPropagation()}>
            <button className="pf-close" onClick={()=>setEditing(null)}>×</button>
            <h3>{editing.id ? form.name || 'Member' : 'Add member'}</h3>

            <div className="grp">Member</div>
            <div className="r2"><L t="Name"><input className="input" value={form.name} onChange={(e)=>set('name',e.target.value)} /></L>
              <L t="Email"><input className="input" value={form.email} onChange={(e)=>set('email',e.target.value)} /></L></div>
            <div className="r2"><L t="Phone"><input className="input" value={form.phone} onChange={(e)=>set('phone',e.target.value)} /></L>
              <L t="Status"><select className="select" value={form.status} onChange={(e)=>set('status',e.target.value)}>
                <option value="active">active</option><option value="pending">pending</option><option value="paused">paused</option><option value="cancelled">cancelled</option></select></L></div>
            <div className="r2"><L t="Tier"><select className="select" value={form.tier} onChange={(e)=>set('tier',e.target.value)}>
                <option value="club">The Club</option><option value="lunch">Club + Launch Lunch</option></select></L>
              <L t="Lunch seats"><input className="input" type="number" min="1" value={form.seats} onChange={(e)=>set('seats',e.target.value)} /></L></div>

            <div className="grp">Delivery address</div>
            <L t="Address line 1"><input className="input" value={form.addr_line1} onChange={(e)=>set('addr_line1',e.target.value)} /></L>
            <L t="Address line 2"><input className="input" value={form.addr_line2} onChange={(e)=>set('addr_line2',e.target.value)} /></L>
            <div className="r2"><L t="City / town"><input className="input" value={form.city} onChange={(e)=>set('city',e.target.value)} /></L>
              <L t="Province"><input className="input" value={form.province} onChange={(e)=>set('province',e.target.value)} /></L></div>
            <div className="r2"><L t="Postal code"><input className="input" value={form.postal_code} onChange={(e)=>set('postal_code',e.target.value)} /></L>
              <L t="Country"><input className="input" value={form.country} onChange={(e)=>set('country',e.target.value)} /></L></div>

            <div className="grp">Payfast & billing</div>
            <L t="Payfast subscription token (needed to pause / cancel / card update)">
              <input className="input" value={form.payfast_token} onChange={(e)=>set('payfast_token',e.target.value)} placeholder="e.g. 48017729-8932-…" /></L>
            {editing.id && (
              <div className="actionbar">
                {form.status === 'paused'
                  ? <button className="btn ghost sm" onClick={()=>subAction('resume')}>Resume billing</button>
                  : <button className="btn ghost sm" onClick={()=>subAction('pause')}>Pause billing</button>}
                {form.status !== 'cancelled' && <button className="btn ghost sm" onClick={()=>subAction('cancel')}>Cancel billing</button>}
                {cardLink
                  ? <button className="btn ghost sm" onClick={()=>copy(cardLink,'Card-update link')}>Copy card-update link</button>
                  : <span className="hint">Add a token to enable billing actions</span>}
              </div>
            )}

            {editing.id && (
              <>
                <div className="grp">Member portal</div>
                <p className="hint">The member signs in at your app address with their email and manages their own address and subscription. Send them this link:</p>
                <div className="actionbar">
                  <button className="btn ghost sm" onClick={()=>copy(portalUrl,'Portal link')}>Copy portal link</button>
                  {form.email && <button className="btn ghost sm" onClick={()=>copy(form.email,'Email')}>Copy email</button>}
                  {form.discount_code && <span className="hint">Discount code: <span className="code">{form.discount_code}</span></span>}
                </div>
              </>
            )}

            <L t="Notes"><textarea className="input" rows="2" value={form.notes} onChange={(e)=>set('notes',e.target.value)} /></L>

            {msg && <p className="hint" style={{ color:'var(--red)' }}>{msg}</p>}

            <div className="foot2">
              {editing.id ? <button className="btn ghost sm" onClick={removeMember} style={{ marginRight:'auto', color:'var(--red)' }}>Delete</button> : <span style={{ marginRight:'auto' }} />}
              <button className="btn ghost" onClick={()=>setEditing(null)}>Close</button>
              <button className="btn" onClick={save} disabled={saving || !form.name}>{saving?'Saving…':'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function L({ t, children }) { return <label style={{ display:'block', marginBottom:12 }}><span className="field">{t}</span>{children}</label>; }
