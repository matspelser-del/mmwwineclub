import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
export const dynamic = 'force-dynamic';
export const LIMIT = 32;

export async function GET() {
  const db = admin();
  const { data } = await db.from('members').select('seats,tier,status').eq('tier','lunch').in('status',['active']);
  const taken = (data||[]).reduce((s,m)=> s + (Number(m.seats)||0), 0);
  return NextResponse.json({ taken, limit: LIMIT, remaining: Math.max(0, LIMIT - taken) });
}
