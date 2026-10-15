import crypto from 'crypto';

// Payfast signs the RAW value (spaces as +). It does NOT trim, so we must not
// either - trimming here silently broke the signature for any field a member
// typed with a leading/trailing space, leaving them stranded as "pending".
const enc = (v) => encodeURIComponent(String(v)).replace(/%20/g, '+');

// ---- ITN (webhook) verification ----
export function verifyItnSignature(orderedPairs, passphrase) {
  const provided = orderedPairs.find(([k]) => k === 'signature');
  if (!provided) return false;
  let str = orderedPairs.filter(([k]) => k !== 'signature').map(([k, v]) => `${k}=${enc(v)}`).join('&');
  if (passphrase) str += `&passphrase=${enc(passphrase)}`;
  return crypto.createHash('md5').update(str).digest('hex') === provided[1];
}

export async function validateItnPostback(orderedPairs, sandbox) {
  const host = sandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';
  const body = orderedPairs.filter(([k]) => k !== 'signature').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  const res = await fetch(`https://${host}/eng/query/validate`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  return (await res.text()).trim() === 'VALID';
}

// Payfast's API expects the timestamp in ISO-8601 with a timezone offset and NO
// milliseconds, e.g. 2026-10-15T10:16:00+02:00. toISOString() returns
// ...:00.000Z, and the millis/Z form is a common cause of the API rejecting the
// request, so build the SAST (UTC+2) form explicitly.
function pfTimestamp() {
  const s = new Date(Date.now() + 2 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${s.getUTCFullYear()}-${p(s.getUTCMonth() + 1)}-${p(s.getUTCDate())}T${p(s.getUTCHours())}:${p(s.getUTCMinutes())}:${p(s.getUTCSeconds())}+02:00`;
}

// ---- Subscription API (pause / unpause / cancel) ----
// Signature = md5 of all header fields + body fields, sorted, + passphrase.
function apiSignature(fields, passphrase) {
  const keys = Object.keys(fields).sort();
  let str = keys.map((k) => `${k}=${enc(fields[k])}`).join('&');
  if (passphrase) str += `&passphrase=${enc(passphrase)}`;
  return crypto.createHash('md5').update(str).digest('hex');
}

async function subAction(action, token) {
  const merchantId = process.env.PAYFAST_MERCHANT_ID || '';
  const passphrase = process.env.PAYFAST_PASSPHRASE || '';
  const sandbox = process.env.PAYFAST_SANDBOX === 'true';
  const timestamp = pfTimestamp();
  const headerFields = { 'merchant-id': merchantId, version: 'v1', timestamp };
  const signature = apiSignature(headerFields, passphrase);
  const base = 'https://api.payfast.co.za';
  const url = `${base}/subscriptions/${token}/${action}${sandbox ? '?testing=true' : ''}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headerFields, signature, 'content-type': 'application/json' },
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text };
}

export const pauseSubscription  = (token) => subAction('pause', token);
export const unpauseSubscription = (token) => subAction('unpause', token);
export const cancelSubscription = (token) => subAction('cancel', token);

// Fetch a subscription's live details from Payfast (next run date, status, amount).
export async function fetchSubscription(token) {
  const merchantId = process.env.PAYFAST_MERCHANT_ID || '';
  const passphrase = process.env.PAYFAST_PASSPHRASE || '';
  const sandbox = process.env.PAYFAST_SANDBOX === 'true';
  const headerFields = { 'merchant-id': merchantId, version: 'v1', timestamp: pfTimestamp() };
  const signature = apiSignature(headerFields, passphrase);
  const url = `https://api.payfast.co.za/subscriptions/${token}/fetch${sandbox ? '?testing=true' : ''}`;
  const res = await fetch(url, { headers: { ...headerFields, signature } });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: text };
  let j; try { j = JSON.parse(text); } catch { return { ok: false, body: text }; }
  const d = j.data?.response || j.data || j;
  return { ok: true, run_date: d.run_date || null, status_text: d.status_text || null, amount: d.amount ?? null, raw: d };
}
