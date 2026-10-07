import { NextResponse } from 'next/server';
import { userFromRequest, isAdminEmail } from '@/lib/auth';
import { admin } from '@/lib/supabaseAdmin';
import { pauseSubscription, unpauseSubscription, cancelSubscription } from '@/lib/payfast';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { memberId, action } = await request.json();
  const db = admin();
  const { data: m } = await db.from('members').select('*').eq('id', memberId).maybeSingle();
  if (!m) return NextResponse.json({ error: 'no member' }, { status: 404 });
  const fn = action === 'pause' ? pauseSubscription : action === 'resume' ? unpauseSubscription : action === 'cancel' ? cancelSubscription : null;
  if (!fn) return NextResponse.json({ error: 'bad action' }, { status: 400 });
  if (!m.payfast_token) return NextResponse.json({ ok: false, outcome: 'no_token' });

  let outcome = 'pending', newStatus = m.status;
  try {
    const r = await fn(m.payfast_token);
    if (r.ok) { outcome = 'done'; newStatus = action === 'cancel' ? 'cancelled' : action === 'pause' ? 'paused' : 'active'; }
  } catch (e) { console.error(e); }
  if (outcome === 'done') await db.from('members').update({ status: newStatus }).eq('id', m.id);
  await db.from('member_events').insert({ member_id: m.id, kind: action, detail: `admin ${action}`, outcome });
  return NextResponse.json({ ok: true, outcome, status: newStatus });
}
