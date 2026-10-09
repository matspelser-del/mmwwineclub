'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { rand, shortDate } from '@/lib/format';
import DashboardSkeleton from '@/components/Skeleton';
import CountUp from '@/components/CountUp';

// Payfast card-update base. The exact URL isn't published, so this is configurable
// and must be verified in sandbox before relying on it.
const CARD_BASE = process.env.NEXT_PUBLIC_PAYFAST_CARD_UPDATE_BASE || 'https://payment.payfast.io/eng/recurring/update';

function Donut({ club, lunch }) {
  const total = club + lunch; const R=52, C=2*Math.PI*R, sw=18;
  const seg=(val,off,color)=> total? <circle cx="70" cy="70" r={R} fill="none" stroke={color} strokeWidth={sw} strokeDasharray={`${val/total*C} ${C-val/total*C}`} strokeDashoffset={-off/total*C} transform="rotate(-90 70 70)"/> : null;
  return (
    <div style={{display:'flex',alignItems:'center',gap:20,flexWrap:'wrap'}}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#efeae3" strokeWidth={sw}/>
        {seg(club,0,'#3a6491')}{seg(lunch,club,'#952B2A')}
        <text x="70" y="68" textAnchor="middle" fontSize="26" fontWeight="700" fill="#1a1a1a" fontFamily="Montserrat, sans-serif" letterSpacing="-0.5">{total}</text>
        <text x="70" y="86" textAnchor="middle" fontSize="11" fill="#77736e">active</text>
      </svg>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        <div style={{display:'flex',alignItems:'center',gap:10,fontSize:14}}><span style={{width:11,height:11,borderRadius:3,background:'#3a6491'}}/><span style={{color:'var(--muted)'}}>The Club</span><b style={{marginLeft:'auto'}}>{club}</b></div>
        <div style={{display:'flex',alignItems:'center',gap:10,fontSize:14}}><span style={{width:11,height:11,borderRadius:3,background:'#952B2A'}}/><span style={{color:'var(--muted)'}}>Club + Lunch</span><b style={{marginLeft:'auto'}}>{lunch}</b></div>
      </div>
    </div>
  );
}

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
  const [onboarding, setOnboarding] = useState(false);
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
  const clubActive = active.filter((m)=>m.tier!=='lunch').length;
  const lunchActive = active.filter((m)=>m.tier==='lunch').length;
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
  function copy(text, label) { navigator.clipboard?.writeText(text); setMsg(`✓ ${label} copied.`); }

  function exportDelivery() {
    const cols = ['Name','Email','Phone','Address 1','Address 2','City','Province','Postal code','Tier','Seats','Discount code'];
    const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
    const lines = [cols.join(',')];
    for (const m of active) {
      lines.push([m.name, m.email, m.phone, m.addr_line1, m.addr_line2, m.city, m.province, m.postal_code,
        m.tier === 'lunch' ? 'Lunch' : 'Club', m.seats || '', m.discount_code].map(esc).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `delivery-run-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  async function onboard() {
    if (!editing?.id) return;
    if (!window.confirm('Run the welcome pipeline? This generates the discount code, creates the WooCommerce coupon, and adds the member to Mailchimp - which sends the welcome email.')) return;
    setOnboarding(true); setMsg('');
    const res = await fetch('/api/admin/onboard', { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ id: editing.id }) });
    const j = await res.json().catch(()=>({}));
    setOnboarding(false);
    if (res.ok) {
      setMsg(`✓ Welcome run - discount: ${j.steps.discount}; coupon: ${j.steps.coupon}; Mailchimp: ${j.steps.mailchimp}.`);
      if (j.code) setForm((f)=>({ ...f, discount_code: j.code }));
      load();
    } else setMsg(j.error || 'Onboarding failed');
  }

  const portalUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const cardLink = form.payfast_token ? `${CARD_BASE}/${form.payfast_token}` : '';

  if (loading) return <DashboardSkeleton />;

  return (
    <>
      <div className="head" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:12 }}>
        <div><h1>Subscriptions</h1><p>{members.length} members · {active.length} active</p></div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn ghost" onClick={exportDelivery} disabled={active.length===0}>Export delivery CSV</button>
          <button className="btn" onClick={openNew}>+ Add member</button>
        </div>
      </div>

      <div className="stats stagger">
        <div className="stat"><div className="l">Active members</div><div className="v"><CountUp value={active.length} /></div></div>
        <div className="stat"><div className="l">Paused</div><div className="v"><CountUp value={paused.length} /></div></div>
        <div className="stat"><div className="l">Payments received</div><div className="v">{rand(revenue)}</div></div>
        <div className="stat"><div className="l">Requests to action</div><div className="v"><CountUp value={pendingReq.length} /></div></div>
      </div>

      {active.length > 0 && (
        <div className="card pad" style={{ marginBottom: 18, maxWidth: 420 }}>
          <h3>Active members by tier</h3>
          <Donut club={clubActive} lunch={lunchActive} />
        </div>
      )}

      <input className="input search" placeholder="Search name, email, town, code…" value={q} onChange={(e)=>setQ(e.target.value)} />

      <div className="card subs">
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
                <option value="active">Active</option><option value="pending">Pending</option><option value="paused">Paused</option><option value="cancelled">Cancelled</option></select></L></div>
            <L t="Membership">
              <select className="select"
                value={form.tier==='club' ? 'club' : (Number(form.seats)>=2 ? 'lunch2' : 'lunch1')}
                onChange={(e)=>{ const v=e.target.value;
                  if(v==='club'){ set('tier','club'); set('seats',1); }
                  else if(v==='lunch1'){ set('tier','lunch'); set('seats',1); }
                  else { set('tier','lunch'); set('seats',2); } }}>
                <option value="club">The Family Wine Club</option>
                <option value="lunch1">Club + Launch Lunch (1 seat)</option>
                <option value="lunch2">Club + Launch Lunch (2 seats)</option>
              </select></L>

            <div className="grp">Delivery address</div>
            <L t="Address line 1"><input className="input" value={form.addr_line1} onChange={(e)=>set('addr_line1',e.target.value)} /></L>
            <L t="Address line 2"><input className="input" value={form.addr_line2} onChange={(e)=>set('addr_line2',e.target.value)} /></L>
            <div className="r2"><L t="City / town"><input className="input" value={form.city} onChange={(e)=>set('city',e.target.value)} /></L>
              <L t="Province"><input className="input" value={form.province} onChange={(e)=>set('province',e.target.value)} /></L></div>
            <L t="Postal code"><input className="input" value={form.postal_code} onChange={(e)=>set('postal_code',e.target.value)} /></L>

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

            {editing.id && (
              <>
                <div className="grp">Welcome &amp; discount</div>
                <p className="hint">For a member added by hand, or whose payment never reached the app (old customer, stale page). Generates the discount code, creates the WooCommerce coupon, and adds them to Mailchimp so the welcome email fires. Safe to run once; re-running reuses the existing code and won't duplicate the coupon.</p>
                <div className="actionbar">
                  <button className="btn sm" onClick={onboard} disabled={onboarding}>{onboarding?'Running…':(form.discount_code?'Re-send welcome':'Onboard & send welcome')}</button>
                  {form.discount_code && <span className="hint">Current code: <span className="code">{form.discount_code}</span></span>}
                </div>
              </>
            )}

            <L t="Notes"><textarea className="input" rows="2" value={form.notes} onChange={(e)=>set('notes',e.target.value)} /></L>

            {msg && <p className="hint" style={{ color: msg.startsWith('✓')?'var(--green)':'var(--red)' }}>{msg}</p>}

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
