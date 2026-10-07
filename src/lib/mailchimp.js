// Add a new member to the Mailchimp audience. A Mailchimp automation set to
// fire on "someone joins the audience" (or on the tag) sends the welcome email.
export async function addToAudience({ email, name, discountCode, tier }) {
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
      tags: ['Wine Club', tier === 'lunch' ? 'Club + Lunch' : 'Club'],
    }),
  });
  // 400 usually means the address is already on the list; treat that as fine.
  if (!res.ok && res.status !== 400) throw new Error('Mailchimp ' + res.status + ' ' + (await res.text()));
  return true;
}
