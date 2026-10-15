'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    const redirect = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { emailRedirectTo: redirect } });
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  }

  return (
    <div className="site">
      <img className="logo" src="/logo-white.png" alt="Miles Mossop Wines" />
      <div className="panel" style={{ maxWidth: 420 }}>
        <div className="eyebrow">The Family Wine Club</div>
        <h1>Member login</h1>
        {sent ? (
          <>
            <p>Check your email - we've sent a sign-in link to <b style={{ color: '#efeae3' }}>{email}</b>. Tap it on this device and you'll land straight in your account.</p>
            <p className="note" style={{ marginTop: 14 }}>
              Wrong email? <a className="link" style={{ cursor: 'pointer' }} onClick={() => { setSent(false); setErr(''); }}>Try another</a>
            </p>
          </>
        ) : (
          <form onSubmit={submit}>
            <p>Enter the email you joined with and we'll send you a sign-in link. No password needed.</p>
            <label className="field" htmlFor="login-email">Email</label>
            <input id="login-email" className="input" type="email" autoComplete="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ marginBottom: 12 }} />
            <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Sending…' : 'Send me a link'}</button>
            {err && <p className="note" style={{ color: '#d98b88' }}>{err}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
