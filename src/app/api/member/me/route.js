import { NextResponse } from 'next/server';
import { userFromRequest, isAdminEmail } from '@/lib/auth';
import { admin } from '@/lib/supabaseAdmin';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data } = await admin().from('members').select('*').eq('email', user.email.toLowerCase()).maybeSingle();
  return NextResponse.json({ member: data || null, isAdmin: isAdminEmail(user.email), email: user.email });
}
