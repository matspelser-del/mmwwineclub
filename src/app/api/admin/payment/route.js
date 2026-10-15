import { NextResponse } from 'next/server';
import { userFromRequest, isAdminEmail } from '@/lib/auth';
import { admin } from '@/lib/supabaseAdmin';
export const dynamic = 'force-dynamic';

async function gate(request) {
  const u = await userFromRequest(request);
  return (u && isAdminEmail(u.email)) ? u : null;
}

// Manually record a completed payment - e.g. to reconcile a charge Payfast took
// but the webhook missed, so "Payments received" reflects the real total.
export async function POST(request) {
  if (!(await gate(request))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await request.json();
  if (!b.member_id) return NextResponse.json({ error: 'member_id required' }, { status: 400 });
  const amount = Number(b.amount);
  if (!amount || amount <= 0) return NextResponse.json({ error: 'a valid amount is required' }, { status: 400 });

  const row = {
    member_id: b.member_id, amount, status: 'complete',
    item_name: b.item_name || 'Recorded manually', payfast_payment_id: null,
  };
  if (b.date) row.created_at = new Date(b.date).toISOString();
  const { error } = await admin().from('payments').insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
