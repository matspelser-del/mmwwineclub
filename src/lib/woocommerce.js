// Create a unique percentage coupon in WooCommerce for a member.
export async function createCoupon({ code, percent }) {
  const base = (process.env.WOO_STORE_URL || '').replace(/\/$/, '');
  const ck = process.env.WOO_CONSUMER_KEY || '';
  const cs = process.env.WOO_CONSUMER_SECRET || '';
  if (!base || !ck || !cs) throw new Error('WooCommerce not configured');
  const auth = 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64');
  const res = await fetch(`${base}/wp-json/wc/v3/coupons`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      discount_type: 'percent',
      amount: String(percent),
      individual_use: true,
      description: 'Wine Club member discount',
    }),
  });
  if (!res.ok) throw new Error('WooCommerce ' + res.status + ' ' + (await res.text()));
  const j = await res.json();
  return String(j.id);
}
