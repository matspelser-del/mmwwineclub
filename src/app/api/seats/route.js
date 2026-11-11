import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
import { lunchSeatsTaken, LUNCH_LIMIT } from '@/lib/seats';
export const dynamic = 'force-dynamic';
export const LIMIT = LUNCH_LIMIT;

export async function GET() {
  const taken = await lunchSeatsTaken(admin());
  return NextResponse.json({ taken, limit: LUNCH_LIMIT, remaining: Math.max(0, LUNCH_LIMIT - taken) });
}
