import { NextResponse } from 'next/server';
import { verifyItnSignature, validateItnPostback } from '@/lib/payfast';
import { admin } from '@/lib/supabaseAdmin';
import { genCode } from '@/lib/discount';
import { createCoupon } from '@/lib/woocommerce';
import { addToAudience } from '@/lib/mailchimp';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const form = await request.formData();
  const ordered = []; const data = {};
  for (const [k, v] of form.entries()) { ordered.push([k, v]); data[k] = v; }

  const sandbox = process.env.PAYFAST_SANDBOX === 'true';
  const passphrase = process.env.PAYFAST_PASSPHRASE || '';

  if (!verifyItnSignature(ordered, passphrase)) return new NextResponse('bad signature', { status: 400 });
  if (!(await validateItnPostback(ordered, sandbox))) return new NextResponse('not validated', { status: 400 });

  const db = admin();
  const status = String(data.payment_status || '').toUpperCase();
  const email = String(data.email_address || '').toLowerCase();
  const amount = parseFloat(data.amount_gross || data.amount || '0');
  const itemName = data.item_name || '';
  const token = data.token || null;
  const tier = itemName.toLowerCase().includes('lunch') ? 'lunch' : 'club';
  const name = `${data.name_first || ''} ${data.name_last || ''}`.trim();
  // capture an address if Payfast happens to send one (fields may be absent)
  const addr = {
    addr_line1: data.line1 || null, addr_line2: data.line2 || null,
    city: data.city || null, province: data.region || null,
    postal_code: data.code || null,
  };

  // find or create the member
  let member = null;
  if (email) {
    const { data: existing } = await db.from('members').select('*').eq('email', email).maybeSingle();
    if (existing) member = existing;
    else {
      const { data: created } = await db.from('members').insert({
        email, name: name || email, tier,
        status: status === 'COMPLETE' ? 'active' : 'pending',
        payfast_token: token, start_date: new Date().toISOString().slice(0, 10),
        ...(addr.addr_line1 ? addr : {}),
      }).select('*').single();
      member = created;
    }
  }

  // log the payment
  await db.from('payments').insert({
    member_id: member ? member.id : null, amount, status: status.toLowerCase(),
    payfast_payment_id: data.pf_payment_id || null, payfast_token: token, item_name: itemName, raw: data,
  });

  if (member && status === 'COMPLETE') {
    const patch = { status: 'active', payfast_token: token };
    // First successful payment for this member: run the welcome side-effects once.
    if (!member.discount_code) {
      const code = genCode(member.name);
      patch.discount_code = code;
      try { patch.woo_coupon_id = await createCoupon({ code, percent: Number(process.env.DISCOUNT_PERCENT || '10') }); }
      catch (e) { console.error('woo coupon failed', e); }
      try { await addToAudience({ email, name: member.name, discountCode: code, tier }); patch.mailchimp_added = true; }
      catch (e) { console.error('mailchimp add failed', e); }
    }
    await db.from('members').update(patch).eq('id', member.id);
  }
  if (member && status === 'CANCELLED') {
    await db.from('members').update({ status: 'cancelled' }).eq('id', member.id);
  }

  return new NextResponse('OK', { status: 200 });
}
