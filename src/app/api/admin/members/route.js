import { NextResponse } from 'next/server';
import { userFromRequest, isAdminEmail } from '@/lib/auth';
import { admin } from '@/lib/supabaseAdmin';
export const dynamic = 'force-dynamic';

async function gate(request) {
  const user = await userFromRequest(request);
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

export async function GET(request) {
  if (!(await gate(request))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const db = admin();
  const [m, p, e] = await Promise.all([
    db.from('members').select('*').order('created_at', { ascending: false }),
    db.from('payments').select('*').order('created_at', { ascending: false }).limit(100),
    db.from('member_events').select('*').order('created_at', { ascending: false }).limit(100),
  ]);
  return NextResponse.json({ members: m.data || [], payments: p.data || [], events: e.data || [] });
}

const FIELDS = ['email','name','phone','tier','seats','status','payfast_token','start_date',
  'addr_line1','addr_line2','city','province','postal_code','country','discount_code','notes'];

function clean(body) {
  const row = {};
  for (const f of FIELDS) if (f in body) row[f] = body[f] === '' ? null : body[f];
  if ('seats' in row && row.seats != null) row.seats = Number(row.seats) || 1;
  return row;
}

export async function POST(request) {         // create a member manually
  if (!(await gate(request))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await request.json();
  const row = clean(body);
  if (!row.name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const { data, error } = await admin().from('members').insert(row).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ member: data });
}

export async function PATCH(request) {        // update a member
  if (!(await gate(request))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const row = clean(body);
  const { error } = await admin().from('members').update(row).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {       // remove a member
  if (!(await gate(request))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await admin().from('members').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
