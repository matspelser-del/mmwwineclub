import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth';
import { admin } from '@/lib/supabaseAdmin';
import { pauseSubscription, unpauseSubscription, cancelSubscription } from '@/lib/payfast';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { action } = await request.json(); // 'pause' | 'resume' | 'cancel'
  const db = admin();
  const { data: m } = await db.from('members').select('*').eq('email', user.email.toLowerCase()).maybeSingle();
  if (!m) return NextResponse.json({ error: 'no member' }, { status: 404 });

  const fn = action === 'pause' ? pauseSubscription : action === 'resume' ? unpauseSubscription : action === 'cancel' ? cancelSubscription : null;
  if (!fn || !m.payfast_token) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  let outcome = 'pending';
  let newStatus = m.status;
  try {
    const r = await fn(m.payfast_token);
    if (r.ok) {
      outcome = 'done';
      newStatus = action === 'cancel' ? 'cancelled' : action === 'pause' ? 'paused' : 'active';
    } else { outcome = 'pending'; } // Payfast refused: leave for manual handling
  } catch (e) { console.error('payfast sub action', e); outcome = 'pending'; }

  if (outcome === 'done') await db.from('members').update({ status: newStatus }).eq('id', m.id);
  await db.from('member_events').insert({ member_id: m.id, kind: action, detail: `member requested ${action}`, outcome });

  return NextResponse.json({ ok: true, outcome });
}
