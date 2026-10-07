import { NextResponse } from 'next/server';
import { userFromRequest, isAdminEmail } from '@/lib/auth';
import { recentCampaigns } from '@/lib/mailchimp';
export const dynamic = 'force-dynamic';
export async function GET(request){
  const u=await userFromRequest(request);
  if(!u || !isAdminEmail(u.email)) return NextResponse.json({error:'forbidden'},{status:403});
  try { return NextResponse.json({ campaigns: await recentCampaigns(12) }); }
  catch(e){ return NextResponse.json({ campaigns: [], error: 'Mailchimp not reachable' }); }
}
