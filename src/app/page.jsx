'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { router.replace('/login'); return; }
      const res = await fetch('/api/member/me', { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json().catch(() => ({}));
      router.replace(j.isAdmin ? '/admin' : '/account');
    })();
  }, [router]);
  return <div className="center">Loading…</div>;
}
