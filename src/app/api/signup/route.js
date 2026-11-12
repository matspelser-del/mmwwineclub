import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
import { lunchSeatsTaken, LUNCH_LIMIT } from '@/lib/seats';
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
  // Launch lunch is sold out - only the Club is open to new signups. Remove this
  // block to reopen lunch (the seat-cap logic below still enforces the limit).
  if (t.tier === 'lunch') return NextResponse.json({ error: 'The launch lunch is sold out. Please join the wine club.' }, { status: 409 });
  // required fields
  for (const f of ['name','email','phone','addr_line1','city','postal_code']) {
    if (!b[f] || !String(b[f]).trim()) return NextResponse.json({ error: `${f} required` }, { status: 400 });
  }
  const email = String(b.email).toLowerCase().trim();
  const db = admin();

  // Lunch seat cap. Counts active members AND unexpired holds from people currently
  // paying (see lib/seats), so two people can't both pass the check on the last seat
  // minutes apart. Excludes this email so a re-submit never blocks itself.
  if (t.tier === 'lunch') {
    const taken = await lunchSeatsTaken(db, email);
    if (taken + t.seats > LUNCH_LIMIT) {
      const left = Math.max(0, LUNCH_LIMIT - taken);
      return NextResponse.json({ error: left === 0 ? 'The launch lunch is fully booked.' : `Only ${left} launch lunch seat${left===1?'':'s'} left, please choose fewer.` }, { status: 409 });
    }
  }
  // Write to interests, NOT members. Filling the form is interest, not membership.
  // The member record is created only when a real payment arrives (see the webhook),
  // which keeps the member list free of non-payers and duplicates.
  const row = {
    email, name: b.name, phone: b.phone, plan: b.plan, tier: t.tier, seats: t.seats,
    status: 'interested', pay_started_at: new Date().toISOString(),
    addr_line1: b.addr_line1, addr_line2: b.addr_line2 || null, city: b.city,
    province: b.province || null, postal_code: b.postal_code, country: b.country || 'South Africa',
  };
  // upsert on email so re-submitting the form updates the same interest
  const { data: existing } = await db.from('interests').select('id').eq('email', email).maybeSingle();
  if (existing) await db.from('interests').update(row).eq('id', existing.id);
  else await db.from('interests').insert(row);
  return NextResponse.json({ ok: true, amount: t.amount, item: t.item });
}
