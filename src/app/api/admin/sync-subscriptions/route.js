import { NextResponse } from 'next/server';
import { userFromRequest, isAdminEmail } from '@/lib/auth';
import { admin } from '@/lib/supabaseAdmin';
import { fetchSubscription } from '@/lib/payfast';
export const dynamic = 'force-dynamic';

async function gate(request) {
  const u = await userFromRequest(request);
  return (u && isAdminEmail(u.email)) ? u : null;
}

// Read each member's live subscription from Payfast and store the next run date.
export async function POST(request) {
  if (!(await gate(request))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const db = admin();
  const { data: members } = await db.from('members').select('id,email,payfast_token')
    .not('payfast_token', 'is', null).neq('payfast_token', '');

  let updated = 0; const failed = [];
  for (const m of members || []) {
    if (!m.payfast_token) continue;
    try {
      const r = await fetchSubscription(m.payfast_token);
      if (r.ok && r.run_date) {
        await db.from('members').update({ next_payment_date: r.run_date, sub_status: r.status_text, sub_synced_at: new Date().toISOString() }).eq('id', m.id);
        updated++;
      } else {
        failed.push({ email: m.email, error: r.body || `status ${r.status || '?'}` });
      }
    } catch (e) { failed.push({ email: m.email, error: e.message }); }
  }
  const withToken = (members || []).filter((m) => m.payfast_token).length;
  return NextResponse.json({ ok: true, updated, withToken, failed });
}
