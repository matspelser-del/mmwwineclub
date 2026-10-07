import { NextResponse } from 'next/server';
import { userFromRequest, isAdminEmail } from '@/lib/auth';
import { admin } from '@/lib/supabaseAdmin';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const db = admin();
  const [m, p, e] = await Promise.all([
    db.from('members').select('*').order('created_at', { ascending: false }),
    db.from('payments').select('*').order('created_at', { ascending: false }).limit(50),
    db.from('member_events').select('*').order('created_at', { ascending: false }).limit(50),
  ]);
  return NextResponse.json({ members: m.data || [], payments: p.data || [], events: e.data || [] });
}
