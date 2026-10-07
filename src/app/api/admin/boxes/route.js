import { NextResponse } from 'next/server';
import { userFromRequest, isAdminEmail } from '@/lib/auth';
import { admin } from '@/lib/supabaseAdmin';
export const dynamic = 'force-dynamic';
async function gate(r){ const u=await userFromRequest(r); return (u && isAdminEmail(u.email)) ? u : null; }

export async function GET(request){
  if(!(await gate(request))) return NextResponse.json({error:'forbidden'},{status:403});
  const db=admin();
  const [b,i,t,w,m]=await Promise.all([
    db.from('boxes').select('*').order('position',{ascending:true}),
    db.from('box_items').select('*').order('position',{ascending:true}),
    db.from('box_timeline').select('*').order('due_date',{ascending:true}),
    db.from('wines').select('*').order('producer',{ascending:true}),
    db.from('members').select('status,tier,seats'),
  ]);
  const activeMembers=(m.data||[]).filter(x=>x.status==='active').length;
  return NextResponse.json({boxes:b.data||[],items:i.data||[],timeline:t.data||[],wines:w.data||[],activeMembers});
}
export async function POST(request){
  if(!(await gate(request))) return NextResponse.json({error:'forbidden'},{status:403});
  const b=await request.json();
  const {data,error}=await admin().from('boxes').insert({label:b.label,release_date:b.release_date||null,status:b.status||'planning',member_note:b.member_note||null,notes:b.notes||null,delivery_fee:Number(b.delivery_fee)||0,position:Number(b.position)||0}).select().single();
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({box:data});
}
export async function PATCH(request){
  if(!(await gate(request))) return NextResponse.json({error:'forbidden'},{status:403});
  const b=await request.json(); if(!b.id) return NextResponse.json({error:'id'},{status:400});
  const patch={};
  for(const f of ['label','release_date','status','member_note','notes']) if(f in b) patch[f]=b[f]===''?null:b[f];
  if('delivery_fee' in b) patch.delivery_fee=Number(b.delivery_fee)||0;
  await admin().from('boxes').update(patch).eq('id',b.id);
  return NextResponse.json({ok:true});
}
