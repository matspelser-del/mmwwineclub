import crypto from 'crypto';

const enc = (v) => encodeURIComponent(String(v).trim()).replace(/%20/g, '+');

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
  const timestamp = new Date().toISOString();
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
