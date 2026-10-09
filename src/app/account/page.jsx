'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const BLANK = { name:'', phone:'', addr_line1:'', addr_line2:'', city:'', province:'', postal_code:'', country:'South Africa' };
const SHOP_URL = process.env.NEXT_PUBLIC_SHOP_URL || '';
// member-friendly words for internal box statuses
const STATUS_LABEL = { confirmed:'Confirmed', packing:'Being packed', shipped:'On its way', done:'Delivered' };

export default function Account() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [member, setMember] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token;
      if (!t) { router.replace('/login'); return; }
      setToken(t);
      const res = await fetch('/api/member/me', { headers: { Authorization: `Bearer ${t}` } });
      const j = await res.json();
      if (j.isAdmin) { router.replace('/admin'); return; }
      setMember(j.member);
      fetch('/api/member/boxes', { headers: { Authorization: `Bearer ${t}` } }).then(r=>r.json()).then(d=>{ setUpcoming(d.upcoming||[]); setPast(d.past||[]); }).catch(()=>{});
      if (j.member) setForm({ ...BLANK, ...Object.fromEntries(Object.keys(BLANK).map((k) => [k, j.member[k] || BLANK[k]])) });
      setLoading(false);
    })();
  }, [router]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  async function saveAddress() {
    setSaving(true); setMsg('');
    const res = await fetch('/api/member/address', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false);
    setMsg(res.ok ? 'Saved. Thank you.' : 'Something went wrong, please try again.');
    if (res.ok) setMember((m) => ({ ...m, ...form }));
  }
  async function subAction(action) {
    const label = action === 'cancel' ? 'cancel' : action === 'pause' ? 'pause' : 'resume';
    if (!confirm(`Are you sure you want to ${label} your membership?`)) return;
    const res = await fetch('/api/member/subscription', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    const j = await res.json();
    if (j.ok && j.outcome === 'done') { setMsg(`Your membership has been ${label === 'resume' ? 'resumed' : label + 'd'}.`); setMember((m) => ({ ...m, status: action === 'cancel' ? 'cancelled' : action === 'pause' ? 'paused' : 'active' })); }
    else setMsg(`Your ${label} request has been received. We'll confirm it shortly.`);
  }
  async function toggleSkip(boxId, skip) {
    setUpcoming((bs) => bs.map((b) => b.id === boxId ? { ...b, skipped: skip } : b));
    await fetch('/api/member/skip', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ boxId, skip }) }).catch(() => {});
  }
  function copyCode() {
    if (!member?.discount_code) return;
    navigator.clipboard?.writeText(member.discount_code);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  }
  async function signOut() { await supabase.auth.signOut(); router.replace('/login'); }

  if (loading) return <div className="loader-full"><div className="session-spinner" /></div>;

  return (
    <div className="site">
      <img className="logo" src="/logo-white.png" alt="Miles Mossop Wines" />
      <div className="panel">
        <div className="eyebrow">The Family Wine Club</div>
        <h1>Your membership</h1>

        {!member ? (
          <p>We couldn't find a membership for this email yet. If you've just joined, give it a few minutes, or reply to your welcome email and we'll sort it out.</p>
        ) : (
          <>
            <div className="dark-card">
              <h3>{member.tier === 'lunch' ? 'The Club + Launch Lunch' : 'The Family Wine Club'}</h3>
              <p className="muted" style={{ marginBottom: 10 }}>
                Status: <b style={{ color: '#efeae3', textTransform: 'capitalize' }}>{member.status}</b>
                {member.start_date ? ` · member since ${new Date(member.start_date).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}` : ''}
              </p>
              {member.discount_code && (
                <p className="muted" style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  Your member discount code: <span className="code">{member.discount_code}</span>
                  <button className="btn ghost sm" onClick={copyCode} style={{ padding:'4px 12px' }}>{copied ? 'Copied' : 'Copy'}</button>
                </p>
              )}
            </div>

            <h2>Delivery address</h2>
            <p className="muted" style={{ marginBottom: 16 }}>This is where your boxes go. Keep it up to date.</p>
            <div className="dark-card">
              <div style={{ marginBottom: 12 }}><label className="field">Full name</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
              <div className="row2" style={{ marginBottom: 12 }}>
                <div><label className="field">Phone</label><input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
                <div><label className="field">Postal code</label><input className="input" value={form.postal_code} onChange={(e) => set('postal_code', e.target.value)} /></div>
              </div>
              <div style={{ marginBottom: 12 }}><label className="field">Address line 1</label><input className="input" value={form.addr_line1} onChange={(e) => set('addr_line1', e.target.value)} /></div>
              <div style={{ marginBottom: 12 }}><label className="field">Address line 2</label><input className="input" value={form.addr_line2} onChange={(e) => set('addr_line2', e.target.value)} /></div>
              <div className="row2" style={{ marginBottom: 16 }}>
                <div><label className="field">City / town</label><input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} /></div>
                <div><label className="field">Province</label><input className="input" value={form.province} onChange={(e) => set('province', e.target.value)} /></div>
              </div>
              <button className="btn" onClick={saveAddress} disabled={saving}>{saving ? 'Saving…' : 'Save address'}</button>
            </div>

            <h2>Upcoming boxes</h2>
            <div className="dark-card">
              {upcoming.length === 0 ? <p className="muted">The schedule will appear here soon.</p> :
                upcoming.map((b) => (
                  <div key={b.id} style={{ padding:'12px 0', borderBottom:'1px solid #2c2a27' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
                      <div style={{ minWidth:0 }}>
                        <b style={{ color: b.skipped ? '#8f877c' : '#efeae3' }}>{b.label}</b>
                        {b.member_note ? <div className="muted" style={{ fontSize:13, marginTop:2 }}>{b.member_note}</div> : null}
                      </div>
                      <span className="muted" style={{ fontSize:13, whiteSpace:'nowrap' }}>{b.skipped ? 'Skipped' : (STATUS_LABEL[b.status] || '')}</span>
                    </div>
                    {member.status === 'active' && (
                      <button className="btn ghost sm" style={{ marginTop:10, padding:'6px 14px' }} onClick={() => toggleSkip(b.id, !b.skipped)}>
                        {b.skipped ? 'Un-skip this box' : 'Skip this box'}
                      </button>
                    )}
                  </div>
                ))}
            </div>

            {past.length > 0 && (
              <>
                <h2>Past boxes</h2>
                <div className="dark-card">
                  {past.map((b) => (
                    <div key={b.id} style={{ padding:'4px 0 16px', borderBottom:'1px solid #2c2a27', marginBottom:14 }}>
                      <b style={{ color:'#efeae3' }}>{b.label} edition</b>
                      {b.wines.length === 0 ? <p className="muted" style={{ fontSize:13, marginTop:6 }}>Line-up coming soon.</p> :
                        <div style={{ marginTop:8 }}>
                          {b.wines.map((w, i) => (
                            <div key={i} style={{ padding:'7px 0', borderTop: i ? '1px solid #242220' : 'none' }}>
                              <span style={{ color:'#efeae3' }}>{w.qty > 1 ? `${w.qty} × ` : '1 × '}{w.name}{w.vintage ? ` ${w.vintage}` : ''}{w.kind === 'extra' ? ' (extra)' : ''}</span>
                              {w.tasting_note ? <div className="muted" style={{ fontSize:13, marginTop:2 }}>{w.tasting_note}</div> : null}
                            </div>
                          ))}
                        </div>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {SHOP_URL && (
              <>
                <h2>Shop our wines</h2>
                <div className="dark-card" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                  <div style={{ minWidth:0 }}>
                    <h3 style={{ marginBottom:4 }}>Between boxes?</h3>
                    <p className="muted" style={{ margin:0 }}>Browse the full range and order anytime. Your member discount code works at checkout.</p>
                  </div>
                  <a className="btn" href={SHOP_URL} target="_blank" rel="noopener noreferrer" style={{ whiteSpace:'nowrap' }}>Shop the range</a>
                </div>
              </>
            )}

            <h2>Manage your subscription</h2>
            <div className="dark-card">
              <p className="muted" style={{ marginBottom: 16 }}>Need a break or want to stop? You can pause or cancel here.</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {member.status === 'paused'
                  ? <button className="btn ghost" onClick={() => subAction('resume')}>Resume</button>
                  : <button className="btn ghost" onClick={() => subAction('pause')}>Pause</button>}
                {member.status !== 'cancelled' && <button className="btn ghost" onClick={() => subAction('cancel')}>Cancel membership</button>}
              </div>
            </div>
          </>
        )}

        {msg && <p className="note">{msg}</p>}
        <p className="note" style={{ marginTop: 20 }}><a className="link" onClick={signOut} style={{ cursor: 'pointer' }}>Sign out</a></p>
      </div>
    </div>
  );
}
