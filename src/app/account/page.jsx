'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const BLANK = { name:'', phone:'', addr_line1:'', addr_line2:'', city:'', province:'', postal_code:'', country:'South Africa' };

export default function Account() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [member, setMember] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

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
  async function signOut() { await supabase.auth.signOut(); router.replace('/login'); }

  if (loading) return <div className="center">Loading…</div>;

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
              {member.discount_code && <p className="muted">Your member discount code: <span className="code">{member.discount_code}</span></p>}
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
