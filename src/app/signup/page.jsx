'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const MERCHANT_ID = process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID || '10814083';
const SANDBOX = process.env.NEXT_PUBLIC_PAYFAST_SANDBOX === 'true';
const PAYFAST_URL = SANDBOX ? 'https://sandbox.payfast.co.za/eng/process' : 'https://payment.payfast.io/eng/process';
// Sandbox only recognises Payfast's generic test merchant; live uses the real one.
const RECEIVER = SANDBOX ? '10000100' : MERCHANT_ID;

// Launch lunch is sold out - only the Club is open to new signups.
const PLANS = {
  club:   { label: 'The Family Wine Club', sub: 'R2500 a quarter' },
};
const BLANK = { name:'', email:'', phone:'', addr_line1:'', addr_line2:'', city:'', province:'', postal_code:'', country:'South Africa' };

function Form() {
  const params = useSearchParams();
  const [plan, setPlan] = useState('club');
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { const p = params.get('plan'); if (p && PLANS[p]) setPlan(p); }, [params]);
  const set = (k,v) => setF((s)=>({ ...s, [k]: v }));

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    const res = await fetch('/api/signup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...f, plan }) });
    const j = await res.json();
    if (!res.ok) { setBusy(false); setErr(j.error ? `Please check: ${j.error.replace('_',' ')}` : 'Something went wrong.'); return; }
    // build and submit the Payfast form with prefilled details
    const origin = window.location.origin;
    const parts = f.name.trim().split(' ');
    const fields = {
      cmd: '_paynow', receiver: RECEIVER,          // Pay Now button mode (same as the website buttons)
      return_url: `${origin}/account`, cancel_url: `${origin}/signup`,
      notify_url: `${origin}/api/payfast/notify`,  // belt-and-braces; also set the ITN URL in Payfast settings

      name_first: parts[0] || '', name_last: parts.slice(1).join(' '),
      email_address: f.email, cell_number: f.phone,
      m_payment_id: f.email,
      amount: String(j.amount), item_name: j.item,
      subscription_type: '1', recurring_amount: '2500', frequency: '4', cycles: '0',
    };
    const form = document.createElement('form');
    form.method = 'POST'; form.action = PAYFAST_URL;
    Object.entries(fields).forEach(([k,v]) => {
      if (v === '') return;
      const i = document.createElement('input'); i.type='hidden'; i.name=k; i.value=v; form.appendChild(i);
    });
    document.body.appendChild(form); form.submit();
  }

  return (
    <form onSubmit={submit}>
      <div className="dark-card" style={{ borderLeft:'3px solid #952B2A', marginBottom:16 }}>
        <b style={{ color:'var(--ink)' }}>First delivery: December 2026</b>
        <br/><span className="muted" style={{ fontSize:14 }}>Join now to hold your place. Your first box is delivered in December, then once a quarter after that.</span>
      </div>

      <div className="dark-card">
        <h3>Your membership</h3>
        <div style={{ padding:'6px 0' }}>
          <b style={{ color:'var(--ink)' }}>The Family Wine Club</b><br/>
          <span className="muted">R2500 a quarter</span>
        </div>
        <p className="muted" style={{ marginTop:8, fontSize:13 }}>The launch lunch is sold out. Join the wine club to be first in line for next year's events.</p>
      </div>

      <h2>Your details</h2>
      <div className="dark-card">
        <div style={{ marginBottom:12 }}><label className="field">Full name *</label><input className="input" value={f.name} onChange={(e)=>set('name',e.target.value)} required /></div>
        <div className="row2" style={{ marginBottom:12 }}>
          <div><label className="field">Email *</label><input className="input" type="email" value={f.email} onChange={(e)=>set('email',e.target.value)} required /></div>
          <div><label className="field">Phone *</label><input className="input" type="tel" value={f.phone} onChange={(e)=>set('phone',e.target.value)} required /></div>
        </div>
        <div className="muted" style={{ fontSize:13 }}>Use the same email when you pay, so we can match your order.</div>
      </div>

      <h2>Delivery address</h2>
      <div className="dark-card">
        <div style={{ marginBottom:12 }}><label className="field">Address line 1 *</label><input className="input" value={f.addr_line1} onChange={(e)=>set('addr_line1',e.target.value)} required /></div>
        <div style={{ marginBottom:12 }}><label className="field">Address line 2</label><input className="input" value={f.addr_line2} onChange={(e)=>set('addr_line2',e.target.value)} /></div>
        <div className="row2" style={{ marginBottom:12 }}>
          <div><label className="field">City / town *</label><input className="input" value={f.city} onChange={(e)=>set('city',e.target.value)} required /></div>
          <div><label className="field">Province</label><input className="input" value={f.province} onChange={(e)=>set('province',e.target.value)} /></div>
        </div>
        <div><label className="field">Postal code *</label><input className="input" value={f.postal_code} onChange={(e)=>set('postal_code',e.target.value)} required /></div>
      </div>

      {err && <p className="note" style={{ color:'#d98b88' }}>{err}</p>}
      <button className="btn" style={{ width:'100%', marginTop:8 }} disabled={busy}>{busy ? 'Taking you to payment…' : 'Continue to payment'}</button>
      <p className="note">You'll complete payment securely on Payfast. First delivery in December 2026, countrywide.</p>
    </form>
  );
}

export default function Signup() {
  return (
    <div className="site">
      <img className="logo" src="/logo-red.png" alt="Miles Mossop Wines" />
      <div className="panel">
        <div className="eyebrow">The Family Wine Club</div>
        <h1>Join the club</h1>
        <Suspense fallback={<p className="muted">Loading…</p>}><Form /></Suspense>
      </div>
    </div>
  );
}
