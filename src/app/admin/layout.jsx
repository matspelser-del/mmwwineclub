'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const path = usePathname();
  const [ok, setOk] = useState(false);
  const cls = (href) => (href === '/admin' ? (path === '/admin' ? 'active' : '') : (path.startsWith(href) ? 'active' : ''));
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { router.replace('/login'); return; }
      const res = await fetch('/api/member/me', { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json().catch(() => ({}));
      if (!j.isAdmin) { router.replace('/account'); return; }
      setOk(true);
    })();
  }, [router]);
  async function signOut() { await supabase.auth.signOut(); router.replace('/login'); }
  if (!ok) return <div className="center">Loading…</div>;
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><img src="/logo-red.png" alt="Miles Mossop Wines" /></div>
        <div style={{ fontSize: 11, color: 'var(--muted)', padding: '0 6px 14px', letterSpacing: '.12em', textTransform: 'uppercase' }}>Wine Club</div>
        <nav className="nav">
          <a href="/admin" className={cls('/admin')}>Subscriptions</a>
          <a href="/admin/boxes" className={cls('/admin/boxes')}>Boxes & Events</a>
          <a href="/admin/builder" className={cls('/admin/builder')}>Box Builder</a>
          <a href="/admin/comms" className={cls('/admin/comms')}>Communications</a>
        </nav>
        <div className="foot"><button onClick={signOut}>Sign out</button></div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
