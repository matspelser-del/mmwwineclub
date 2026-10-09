import { NextResponse } from 'next/server';
import { userFromRequest, isAdminEmail } from '@/lib/auth';
import { admin } from '@/lib/supabaseAdmin';
export const dynamic = 'force-dynamic';
async function gate(r){ const u=await userFromRequest(r); return (u && isAdminEmail(u.email))?u:null; }
export async function POST(request){
  if(!(await gate(request))) return NextResponse.json({error:'forbidden'},{status:403});
  const b=await request.json();
  const {data,error}=await admin().from('box_items').insert({box_id:b.box_id,kind:b.kind||'wine',producer:b.producer||'miles',name:b.name,vintage:b.vintage||null,qty:Number(b.qty)||1,cost_price:Number(b.cost_price)||0,cellar_price:Number(b.cellar_price)||0,tasting_note:b.tasting_note||null}).select().single();
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({item:data});
}
export async function PATCH(request){
  if(!(await gate(request))) return NextResponse.json({error:'forbidden'},{status:403});
  const b=await request.json(); if(!b.id) return NextResponse.json({error:'id'},{status:400});
  const patch={};
  for(const f of ['name','vintage','kind','producer','tasting_note']) if(f in b) patch[f]=b[f];
  for(const f of ['qty','cost_price','cellar_price']) if(f in b) patch[f]=Number(b[f])||0;
  await admin().from('box_items').update(patch).eq('id',b.id);
  return NextResponse.json({ok:true});
}
export async function DELETE(request){
  if(!(await gate(request))) return NextResponse.json({error:'forbidden'},{status:403});
  const id=new URL(request.url).searchParams.get('id');
  await admin().from('box_items').delete().eq('id',id);
  return NextResponse.json({ok:true});
}
