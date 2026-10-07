'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const MERCHANT_ID = process.env.NEXT_PUBLIC_PAYFAST_MERCHANT_ID || '10814083';
const SANDBOX = process.env.NEXT_PUBLIC_PAYFAST_SANDBOX === 'true';
const PAYFAST_URL = SANDBOX ? 'https://sandbox.payfast.co.za/eng/process' : 'https://payment.payfast.io/eng/process';

const PLANS = {
  club:   { label: 'The Family Wine Club', sub: 'R2500 a quarter' },
  lunch1: { label: 'Club + Launch Lunch, one seat', sub: 'R4000 first quarter, then R2500' },
  lunch2: { label: 'Club + Launch Lunch, two seats', sub: 'R5500 first quarter, then R2500' },
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
      merchant_id: MERCHANT_ID, merchant_key: '',   // key not required for onsite buttons
      return_url: `${origin}/account`, cancel_url: `${origin}/signup`,
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
      <div className="dark-card">
        <h3>Choose your membership</h3>
        {Object.entries(PLANS).map(([k,v]) => (
          <label key={k} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'10px 0', cursor:'pointer' }}>
            <input type="radio" name="plan" checked={plan===k} onChange={()=>setPlan(k)} style={{ marginTop:4 }} />
            <span><b style={{ color:'#efeae3' }}>{v.label}</b><br/><span className="muted">{v.sub}</span></span>
          </label>
        ))}
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
        <div className="row2">
          <div><label className="field">Postal code *</label><input className="input" value={f.postal_code} onChange={(e)=>set('postal_code',e.target.value)} required /></div>
          <div><label className="field">Country</label><input className="input" value={f.country} onChange={(e)=>set('country',e.target.value)} /></div>
        </div>
      </div>

      {err && <p className="note" style={{ color:'#d98b88' }}>{err}</p>}
      <button className="btn" style={{ width:'100%', marginTop:8 }} disabled={busy}>{busy ? 'Taking you to payment…' : 'Continue to payment'}</button>
      <p className="note">You'll complete payment securely on Payfast. Delivery is countrywide.</p>
    </form>
  );
}

export default function Signup() {
  return (
    <div className="site">
      <img className="logo" src="/logo-white.png" alt="Miles Mossop Wines" />
      <div className="panel">
        <div className="eyebrow">The Family Wine Club</div>
        <h1>Join the club</h1>
        <Suspense fallback={<p className="muted">Loading…</p>}><Form /></Suspense>
      </div>
    </div>
  );
}
