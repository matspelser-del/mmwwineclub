import { createHash } from 'crypto';

// The tier tag that drives the tier-specific welcome automation.
export function tierTag(tier, seats) {
  if (tier === 'lunch') return Number(seats) >= 2 ? 'Club + Lunch (2 seats)' : 'Club + Lunch (1 seat)';
  return 'Club';
}

// Upsert a member into the audience and apply the Wine Club tags.
// Two calls on purpose:
//   1. PUT upserts the contact (works whether or not they already exist) and
//      writes the merge fields, including the DISCOUNT code the welcome email uses.
//      The old POST /members call 400'd for anyone already in the audience and the
//      code swallowed it, so existing contacts got no tag and no discount.
//   2. POST to the /tags endpoint applies each tag as a discrete "tag added" event,
//      which is what a Customer Journey tag trigger actually listens for. Tags set
//      inside a create call do not reliably fire that trigger.
export async function addToAudience({ email, name, discountCode, tier, seats }) {
  const key = process.env.MAILCHIMP_API_KEY || '';
  const audience = process.env.MAILCHIMP_AUDIENCE_ID || '';
  const dc = key.split('-')[1]; // server prefix, e.g. us21
  if (!key || !dc || !audience) throw new Error('Mailchimp not configured');

  const addr = String(email || '').trim().toLowerCase();
  const hash = createHash('md5').update(addr).digest('hex');
  const parts = String(name || '').trim().split(' ');
  const auth = 'Basic ' + Buffer.from('any:' + key).toString('base64');
  const base = `https://${dc}.api.mailchimp.com/3.0/lists/${audience}/members/${hash}`;

  // 1. upsert contact + merge fields
  const put = await fetch(base, {
    method: 'PUT',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email_address: addr,
      status_if_new: 'subscribed',   // only sets status for brand-new contacts; never resubscribes
      merge_fields: { FNAME: parts[0] || '', LNAME: parts.slice(1).join(' '), DISCOUNT: discountCode || '' },
    }),
  });
  if (!put.ok) throw new Error('Mailchimp upsert ' + put.status + ' ' + (await put.text()));

  // 2. apply tags as their own event (fires the automation trigger)
  const tags = ['Wine Club', tierTag(tier, seats)].map((name) => ({ name, status: 'active' }));
  const tagRes = await fetch(`${base}/tags`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags }),
  });
  if (!tagRes.ok && tagRes.status !== 204) throw new Error('Mailchimp tags ' + tagRes.status + ' ' + (await tagRes.text()));
  return true;
}

// Apply a tag to one contact as a fresh "tag added" event, so a Customer Journey
// that triggers on the tag fires every time (we remove it first, then re-add).
// Used for the per-box "on its way" notification.
export async function retriggerTag(email, tag) {
  const key = process.env.MAILCHIMP_API_KEY || '';
  const audience = process.env.MAILCHIMP_AUDIENCE_ID || '';
  const dc = key.split('-')[1];
  if (!key || !dc || !audience) throw new Error('Mailchimp not configured');
  const addr = String(email || '').trim().toLowerCase();
  const hash = createHash('md5').update(addr).digest('hex');
  const auth = 'Basic ' + Buffer.from('any:' + key).toString('base64');
  const url = `https://${dc}.api.mailchimp.com/3.0/lists/${audience}/members/${hash}/tags`;
  const headers = { Authorization: auth, 'Content-Type': 'application/json' };
  // remove (ignore result), then add
  await fetch(url, { method: 'POST', headers, body: JSON.stringify({ tags: [{ name: tag, status: 'inactive' }] }) }).catch(() => {});
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ tags: [{ name: tag, status: 'active' }] }) });
  return res.ok || res.status === 204;
}

// Read recent sent campaigns (newsletters) for the Communications view.
export async function recentCampaigns(count = 10) {
  const key = process.env.MAILCHIMP_API_KEY || '';
  const dc = key.split('-')[1];
  if (!key || !dc) return [];
  const auth = 'Basic ' + Buffer.from('any:' + key).toString('base64');
  const res = await fetch(`https://${dc}.api.mailchimp.com/3.0/campaigns?count=${count}&sort_field=send_time&sort_dir=DESC&status=sent`, {
    headers: { Authorization: auth },
  });
  if (!res.ok) return [];
  const j = await res.json();
  return (j.campaigns || []).map((c) => ({
    id: c.id,
    title: c.settings?.subject_line || c.settings?.title || '(no subject)',
    sent: c.send_time || null,
    recipients: c.recipients?.recipient_count || 0,
    opens: c.report_summary?.open_rate != null ? Math.round(c.report_summary.open_rate * 100) : null,
    clicks: c.report_summary?.click_rate != null ? Math.round(c.report_summary.click_rate * 100) : null,
  }));
}
