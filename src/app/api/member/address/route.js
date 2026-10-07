import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth';
import { admin } from '@/lib/supabaseAdmin';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await request.json();
  const db = admin();
  const { data: m } = await db.from('members').select('id').eq('email', user.email.toLowerCase()).maybeSingle();
  if (!m) return NextResponse.json({ error: 'no member' }, { status: 404 });
  await db.from('members').update({
    name: b.name, phone: b.phone,
    addr_line1: b.addr_line1, addr_line2: b.addr_line2,
    city: b.city, province: b.province, postal_code: b.postal_code,
    country: b.country || 'South Africa',
  }).eq('id', m.id);
  await db.from('member_events').insert({ member_id: m.id, kind: 'address_update', detail: `${b.addr_line1}, ${b.city}`, outcome: 'done' });
  return NextResponse.json({ ok: true });
}
