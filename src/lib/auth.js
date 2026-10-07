import { admin } from './supabaseAdmin';
// Validate the Supabase access token sent by the browser and return the user.
export async function userFromRequest(request) {
  const h = request.headers.get('authorization') || '';
  const token = h.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data || !data.user) return null;
  return data.user;
}
export function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return !!email && list.includes(String(email).toLowerCase());
}
