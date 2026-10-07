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
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
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
          <p>Check your email. We've sent you a link to sign in, it opens your account in one click.</p>
        ) : (
          <form onSubmit={submit}>
            <p>Enter the email you joined with and we'll send you a sign-in link. No password needed.</p>
            <input className="input" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ marginBottom: 12 }} />
            <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Sending…' : 'Send me a link'}</button>
            {err && <p className="note" style={{ color: '#d98b88' }}>{err}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
