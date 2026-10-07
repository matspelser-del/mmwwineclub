import { NextResponse } from 'next/server';
import { userFromRequest, isAdminEmail } from '@/lib/auth';
import { admin } from '@/lib/supabaseAdmin';
export const dynamic = 'force-dynamic';
async function gate(r){ const u=await userFromRequest(r); return (u && isAdminEmail(u.email))?u:null; }
export async function POST(request){
  if(!(await gate(request))) return NextResponse.json({error:'forbidden'},{status:403});
  const b=await request.json();
  const {data,error}=await admin().from('wines').insert({producer:b.producer||'miles',name:b.name,vintage:b.vintage||null,cost_price:Number(b.cost_price)||0,cellar_price:Number(b.cellar_price)||0,active:b.active!==false}).select().single();
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({wine:data});
}
export async function PATCH(request){
  if(!(await gate(request))) return NextResponse.json({error:'forbidden'},{status:403});
  const b=await request.json(); if(!b.id) return NextResponse.json({error:'id'},{status:400});
  const patch={};
  for(const f of ['name','vintage','producer']) if(f in b) patch[f]=b[f];
  for(const f of ['cost_price','cellar_price']) if(f in b) patch[f]=Number(b[f])||0;
  if('active' in b) patch.active=!!b.active;
  await admin().from('wines').update(patch).eq('id',b.id);
  return NextResponse.json({ok:true});
}
export async function DELETE(request){
  if(!(await gate(request))) return NextResponse.json({error:'forbidden'},{status:403});
  const id=new URL(request.url).searchParams.get('id');
  await admin().from('wines').delete().eq('id',id);
  return NextResponse.json({ok:true});
}
