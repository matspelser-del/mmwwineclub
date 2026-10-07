// Add a new member to the Mailchimp audience. A Mailchimp automation set to
// fire on "someone joins the audience" (or on the tag) sends the welcome email.
export async function addToAudience({ email, name, discountCode, tier, seats }) {
  const key = process.env.MAILCHIMP_API_KEY || '';
  const audience = process.env.MAILCHIMP_AUDIENCE_ID || '';
  const dc = key.split('-')[1]; // server prefix, e.g. us21
  if (!key || !dc || !audience) throw new Error('Mailchimp not configured');
  const parts = String(name || '').trim().split(' ');
  const auth = 'Basic ' + Buffer.from('any:' + key).toString('base64');
  const res = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${audience}/members`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email_address: email,
      status: 'subscribed',
      merge_fields: { FNAME: parts[0] || '', LNAME: parts.slice(1).join(' '), DISCOUNT: discountCode || '' },
      tags: ['Wine Club', tier === 'lunch' ? (Number(seats) >= 2 ? 'Club + Lunch (2 seats)' : 'Club + Lunch (1 seat)') : 'Club'],
    }),
  });
  // 400 usually means the address is already on the list; treat that as fine.
  if (!res.ok && res.status !== 400) throw new Error('Mailchimp ' + res.status + ' ' + (await res.text()));
  return true;
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
