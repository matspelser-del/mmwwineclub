'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { rand, shortDate } from '@/lib/format';

function Badge({ v }) {
  const map = { active: 'green', paused: 'amber', cancelled: 'grey', pending: 'blue' };
  return <span className={`badge ${map[v] || 'grey'}`}><span className="dot" />{v}</span>;
}

export default function AdminHome() {
  const [data, setData] = useState({ members: [], payments: [], events: [] });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      const res = await fetch('/api/admin/members', { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      setData(j); setLoading(false);
    })();
  }, []);

  const members = data.members || [];
  const active = members.filter((m) => m.status === 'active');
  const paused = members.filter((m) => m.status === 'paused');
  const qRevenue = (data.payments || []).filter((p) => p.status === 'complete').reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingReq = (data.events || []).filter((e) => e.outcome === 'pending');

  const filtered = useMemo(() => members.filter((m) =>
    `${m.name} ${m.email} ${m.city || ''} ${m.discount_code || ''}`.toLowerCase().includes(q.toLowerCase())
  ), [members, q]);

  if (loading) return <div className="main"><p className="empty">Loading…</p></div>;

  return (
    <>
      <div className="head"><h1>Subscriptions</h1><p>{members.length} members · {active.length} active</p></div>

      <div className="stats">
        <div className="stat"><div className="l">Active members</div><div className="v">{active.length}</div></div>
        <div className="stat"><div className="l">Paused</div><div className="v">{paused.length}</div></div>
        <div className="stat"><div className="l">Payments received</div><div className="v">{rand(qRevenue)}</div></div>
        <div className="stat"><div className="l">Requests to action</div><div className="v">{pendingReq.length}</div></div>
      </div>

      {pendingReq.length > 0 && (
        <div className="card" style={{ marginBottom: 18, borderColor: 'var(--amber)' }}>
          <div className="rowh" style={{ gridTemplateColumns: '1fr' }}>Pause / cancel requests needing manual action in Payfast</div>
          {pendingReq.map((e) => {
            const m = members.find((x) => x.id === e.member_id);
            return <div className="row" key={e.id} style={{ gridTemplateColumns: '1.4fr 1fr 1fr' }}>
              <div className="nm">{m ? m.name : 'Unknown'}</div><div>{e.kind}</div><div className="sub">{shortDate(e.created_at)}</div>
            </div>;
          })}
        </div>
      )}

      <input className="input search" placeholder="Search name, email, town, code…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="card">
        <div className="rowh"><div>Member</div><div>Delivery address</div><div>Tier</div><div>Status</div><div>Started · code</div></div>
        {filtered.length === 0 ? <div className="empty">No members yet. They appear here automatically when a Payfast subscription comes in.</div> :
          filtered.map((m) => (
            <div className="row" key={m.id}>
              <div><div className="nm">{m.name}</div><div className="sub">{m.email}</div></div>
              <div className="sub">{m.addr_line1 ? `${m.addr_line1}${m.addr_line2 ? ', ' + m.addr_line2 : ''}, ${m.city || ''} ${m.postal_code || ''}` : '— not provided —'}</div>
              <div><span className={`badge ${m.tier === 'lunch' ? 'red' : 'blue'}`}><span className="dot" />{m.tier === 'lunch' ? `Lunch ×${m.seats || 1}` : 'Club'}</span></div>
              <div><Badge v={m.status} /></div>
              <div className="sub">{shortDate(m.start_date)}<br />{m.discount_code ? <span className="code">{m.discount_code}</span> : ''}</div>
            </div>
          ))}
      </div>
    </>
  );
}
