import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth';
import { admin } from '@/lib/supabaseAdmin';
export const dynamic = 'force-dynamic';
export async function GET(request){
  const u=await userFromRequest(request);
  if(!u) return NextResponse.json({error:'unauthorized'},{status:401});
  const db=admin();
  const { data } = await db.from('boxes').select('id,label,release_date,status,member_note').order('position',{ascending:true});
  return NextResponse.json({ boxes: (data||[]) });
}
