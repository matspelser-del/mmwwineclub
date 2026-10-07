import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
export const dynamic = 'force-dynamic';

const TIERS = {
  club:   { amount: 2500, tier: 'club',  seats: 1, item: 'The Family Wine Club' },
  lunch1: { amount: 4000, tier: 'lunch', seats: 1, item: 'The Family Wine Club and one seat at Good to Gather' },
  lunch2: { amount: 5500, tier: 'lunch', seats: 2, item: 'The Family Wine Club and two seats at Good to Gather' },
};

export async function POST(request) {
  const b = await request.json();
  const t = TIERS[b.plan]; 
  if (!t) return NextResponse.json({ error: 'bad plan' }, { status: 400 });
  // required fields
  for (const f of ['name','email','phone','addr_line1','city','postal_code']) {
    if (!b[f] || !String(b[f]).trim()) return NextResponse.json({ error: `${f} required` }, { status: 400 });
  }
  const email = String(b.email).toLowerCase().trim();
  const db = admin();

  // Lunch seat cap (32 total). Count seats already committed, excluding this email if re-trying.
  const LUNCH_LIMIT = 32;
  if (t.tier === 'lunch') {
    const { data: lunchRows } = await db.from('members').select('email,seats,status').eq('tier','lunch').in('status',['active']);
    const taken = (lunchRows||[]).filter(r => r.email !== email).reduce((a,r)=> a + (Number(r.seats)||0), 0);
    if (taken + t.seats > LUNCH_LIMIT) {
      const left = Math.max(0, LUNCH_LIMIT - taken);
      return NextResponse.json({ error: left === 0 ? 'The launch lunch is fully booked.' : `Only ${left} launch lunch seat${left===1?'':'s'} left, please choose fewer.` }, { status: 409 });
    }
  }
  const row = {
    email, name: b.name, phone: b.phone, tier: t.tier, seats: t.seats, status: 'pending',
    addr_line1: b.addr_line1, addr_line2: b.addr_line2 || null, city: b.city,
    province: b.province || null, postal_code: b.postal_code, country: b.country || 'South Africa',
  };
  // upsert on email so re-tries don't duplicate
  const { data: existing } = await db.from('members').select('id').eq('email', email).maybeSingle();
  if (existing) await db.from('members').update(row).eq('id', existing.id);
  else await db.from('members').insert(row);
  return NextResponse.json({ ok: true, amount: t.amount, item: t.item });
}
