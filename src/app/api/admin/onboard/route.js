import { NextResponse } from 'next/server';
import { userFromRequest, isAdminEmail } from '@/lib/auth';
import { admin } from '@/lib/supabaseAdmin';
import { genCode } from '@/lib/discount';
import { createCoupon } from '@/lib/woocommerce';
import { addToAudience } from '@/lib/mailchimp';

export const dynamic = 'force-dynamic';

async function gate(request) {
  const user = await userFromRequest(request);
  return (user && isAdminEmail(user.email)) ? user : null;
}

// Run the welcome pipeline for a member who was added manually or whose payment
// never hit the webhook (old customer, stale page, ITN not configured at the time).
// Idempotent: reuses an existing code, skips the Woo coupon if one already exists,
// and the Mailchimp add tolerates an address that is already on the list.
export async function POST(request) {
  if (!(await gate(request))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = admin();
  const { data: member, error } = await db.from('members').select('*').eq('id', id).single();
  if (error || !member) return NextResponse.json({ error: 'member not found' }, { status: 404 });
  if (!member.email) return NextResponse.json({ error: 'member has no email' }, { status: 400 });

  const steps = { discount: 'skipped', coupon: 'skipped', mailchimp: 'skipped' };
  const patch = {};

  // 1. discount code (reuse if present)
  let code = member.discount_code;
  if (!code) { code = genCode(member.name); patch.discount_code = code; steps.discount = 'created ' + code; }
  else steps.discount = 'existing ' + code;

  // 2. WooCommerce coupon (only if not already created)
  if (!member.woo_coupon_id) {
    try { patch.woo_coupon_id = await createCoupon({ code, percent: Number(process.env.DISCOUNT_PERCENT || '10') }); steps.coupon = 'created'; }
    catch (e) { steps.coupon = 'FAILED: ' + e.message; }
  } else steps.coupon = 'existing';

  // 3. Mailchimp add + tag (fires the welcome automation)
  try {
    await addToAudience({ email: member.email.toLowerCase(), name: member.name, discountCode: code, tier: member.tier, seats: member.seats });
    patch.mailchimp_added = true; steps.mailchimp = 'added + tagged';
  } catch (e) { steps.mailchimp = 'FAILED: ' + e.message; }

  // keep the member active unless they've been cancelled
  if (member.status !== 'cancelled' && member.status !== 'active') patch.status = 'active';
  if (Object.keys(patch).length) await db.from('members').update(patch).eq('id', id);

  const ok = !steps.coupon.startsWith('FAILED') && !steps.mailchimp.startsWith('FAILED');
  return NextResponse.json({ ok, steps, code });
}
