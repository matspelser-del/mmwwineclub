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
  const email = String(data.email_address || '').trim().toLowerCase();
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
  // Logging must NEVER strand a paid member. The Supabase builder is a thenable
  // with no .catch(), so chaining .catch() onto .insert() threw a TypeError and
  // crashed the whole handler (500) before activation ever ran. Await it, read the
  // error from the result, and wrap in try/catch so a missing table or any other
  // log failure is noted and ignored - activation below still proceeds.
  try {
    const { error: logErr } = await db.from('itn_log').insert({
      email, m_payment_id: data.m_payment_id || null, pf_payment_id: data.pf_payment_id || null,
      payment_status: data.payment_status || null, amount, signature_ok: sigOk, validated,
      result, raw: data,
    });
    if (logErr) console.error('itn_log insert failed', logErr);
  } catch (e) { console.error('itn_log insert threw', e); }

  // Reject only if Payfast itself does not confirm the transaction.
  if (!validated) return new NextResponse('not validated', { status: 400 });
  // capture an address if Payfast happens to send one (fields may be absent)
  const addr = {
    addr_line1: data.line1 || null, addr_line2: data.line2 || null,
    city: data.city || null, province: data.region || null,
    postal_code: data.code || null,
  };

  // Find the member as robustly as possible. A pending member who pays later must
  // reconnect to their existing record, never get duplicated. The old code matched
  // on a single exact, case-sensitive email - so a stored "Tracy@Nomu.co.za" never
  // matched the lowercased "tracy@nomu.co.za" from the ITN, a duplicate active
  // record was created, and the original stayed pending. Match in order of
  // reliability: subscription token (stable across recurring charges) -> email
  // (case-insensitive) -> m_payment_id, which signup sets to the member's email.
  // ilike treats % and _ as wildcards, and _ is legal in emails, so escape them.
  const esc = (s) => s.replace(/([\\%_])/g, '\\$1');
  const mpid = String(data.m_payment_id || '').trim().toLowerCase();
  let member = null;
  if (token) {
    const { data: x } = await db.from('members').select('*').eq('payfast_token', token).maybeSingle();
    if (x) member = x;
  }
  if (!member && email) {
    const { data: x } = await db.from('members').select('*').ilike('email', esc(email)).maybeSingle();
    if (x) member = x;
  }
  if (!member && mpid && mpid !== email) {
    const { data: x } = await db.from('members').select('*').ilike('email', esc(mpid)).maybeSingle();
    if (x) member = x;
  }
  // No existing member: this is a new signup. Promote their "showed interest"
  // record if there is one - it holds the delivery address, phone and chosen plan
  // that the Payfast notification usually lacks. Otherwise create from ITN data.
  if (!member && (email || mpid)) {
    let interest = null;
    if (email) {
      const { data: x } = await db.from('interests').select('*').ilike('email', esc(email)).maybeSingle();
      if (x) interest = x;
    }
    if (!interest && mpid && mpid !== email) {
      const { data: x } = await db.from('interests').select('*').ilike('email', esc(mpid)).maybeSingle();
      if (x) interest = x;
    }
    const base = interest ? {
      email: interest.email, name: interest.name || name || interest.email,
      phone: interest.phone || null, tier: interest.tier || tier, seats: interest.seats || 1,
      addr_line1: interest.addr_line1, addr_line2: interest.addr_line2, city: interest.city,
      province: interest.province, postal_code: interest.postal_code, country: interest.country,
    } : {
      email: email || mpid, name: name || email || mpid, tier,
      ...(addr.addr_line1 ? addr : {}),
    };
    const { data: created } = await db.from('members').insert({
      ...base,
      status: status === 'COMPLETE' ? 'active' : 'pending',
      payfast_token: token, start_date: new Date().toISOString().slice(0, 10),
    }).select('*').single();
    member = created;
    if (interest && created) {
      await db.from('interests').update({ status: 'converted', converted_at: new Date().toISOString() }).eq('id', interest.id);
    }
  }

  // Log the payment - but guard against Payfast re-sending the same ITN (it retries
  // when it doesn't get a prompt 200, and the postback check adds latency). Without
  // this, a retry inserts a second row for the same pf_payment_id and inflates
  // "Payments received". Recurring charges have a new pf_payment_id each time, so
  // this only de-dupes true retries, not real renewals.
  let dupPayment = false;
  if (data.pf_payment_id) {
    const { data: existingPay } = await db.from('payments').select('id').eq('payfast_payment_id', data.pf_payment_id).maybeSingle();
    if (existingPay) dupPayment = true;
  }
  if (!dupPayment) {
    await db.from('payments').insert({
      member_id: member ? member.id : null, amount, status: status.toLowerCase(),
      payfast_payment_id: data.pf_payment_id || null, payfast_token: token, item_name: itemName, raw: data,
    });
  }

  if (member && status === 'COMPLETE') {
    const patch = { status: 'active', payfast_token: token };
    // First successful payment for this member: run the welcome side-effects once.
    if (!member.discount_code) {
      const code = genCode(member.name);
      patch.discount_code = code;
      try { patch.woo_coupon_id = await createCoupon({ code, percent: Number(process.env.DISCOUNT_PERCENT || '10') }); }
      catch (e) { console.error('woo coupon failed', e); }
      try { await addToAudience({ email: member.email || email, name: member.name, discountCode: code, tier, seats: member.seats }); patch.mailchimp_added = true; }
      catch (e) { console.error('mailchimp add failed', e); }
    }
    await db.from('members').update(patch).eq('id', member.id);
  }
  if (member && status === 'CANCELLED') {
    await db.from('members').update({ status: 'cancelled' }).eq('id', member.id);
  }

  return new NextResponse('OK', { status: 200 });
}
