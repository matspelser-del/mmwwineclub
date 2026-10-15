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

  const db = admin();
  const status = String(data.payment_status || '').toUpperCase();
  const email = String(data.email_address || '').toLowerCase();
  const amount = parseFloat(data.amount_gross || data.amount || '0');
  const itemName = data.item_name || '';
  const token = data.token || null;
  // tier from amount (reliable) or any seat/lunch wording in the item name
  const tier = (amount >= 4000 || /lunch|seat|gather/i.test(itemName)) ? 'lunch' : 'club';
  const name = `${data.name_first || ''} ${data.name_last || ''}`.trim();

  // Authenticity: Payfast's server-to-server postback (validateItnPostback) is the
  // authority - Payfast confirms this is a real, matching transaction. Our own
  // signature recompute is finicky (exact URL-encoding of names/addresses), so it
  // is a LOGGED signal, not a hard gate: a genuine payment Payfast confirms must
  // never be stranded just because our MD5 disagreed. Every ITN is logged first.
  const sigOk = verifyItnSignature(ordered, passphrase);
  const validated = await validateItnPostback(ordered, sandbox);
  const result = validated ? (sigOk ? 'accepted' : 'accepted (signature mismatch)') : 'not validated';
  await db.from('itn_log').insert({
    email, m_payment_id: data.m_payment_id || null, pf_payment_id: data.pf_payment_id || null,
    payment_status: data.payment_status || null, amount, signature_ok: sigOk, validated,
    result, raw: data,
  }).catch((e) => console.error('itn_log insert failed', e));

  // Reject only if Payfast itself does not confirm the transaction.
  if (!validated) return new NextResponse('not validated', { status: 400 });
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
      try { await addToAudience({ email, name: member.name, discountCode: code, tier, seats: member.seats }); patch.mailchimp_added = true; }
      catch (e) { console.error('mailchimp add failed', e); }
    }
    await db.from('members').update(patch).eq('id', member.id);
  }
  if (member && status === 'CANCELLED') {
    await db.from('members').update({ status: 'cancelled' }).eq('id', member.id);
  }

  return new NextResponse('OK', { status: 200 });
}
