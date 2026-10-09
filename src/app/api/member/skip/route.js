import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth';
import { admin } from '@/lib/supabaseAdmin';
export const dynamic = 'force-dynamic';

// Toggle a member skipping a specific upcoming box.
export async function POST(request) {
  const u = await userFromRequest(request);
  if (!u) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { boxId, skip } = await request.json();
  if (!boxId) return NextResponse.json({ error: 'boxId required' }, { status: 400 });

  const db = admin();
  const { data: m } = await db.from('members').select('id').eq('email', u.email.toLowerCase()).maybeSingle();
  if (!m) return NextResponse.json({ error: 'no member' }, { status: 404 });

  if (skip) {
    await db.from('box_skips').upsert({ member_id: m.id, box_id: boxId }, { onConflict: 'member_id,box_id' });
  } else {
    await db.from('box_skips').delete().eq('member_id', m.id).eq('box_id', boxId);
  }
  await db.from('member_events').insert({ member_id: m.id, kind: skip ? 'skip' : 'unskip', detail: `box ${boxId}`, outcome: 'done' });
  return NextResponse.json({ ok: true, skipped: !!skip });
}
