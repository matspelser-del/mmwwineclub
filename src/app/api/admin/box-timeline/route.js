import { NextResponse } from 'next/server';
import { userFromRequest, isAdminEmail } from '@/lib/auth';
import { admin } from '@/lib/supabaseAdmin';
export const dynamic = 'force-dynamic';
async function gate(r){ const u=await userFromRequest(r); return (u && isAdminEmail(u.email))?u:null; }
export async function POST(request){
  if(!(await gate(request))) return NextResponse.json({error:'forbidden'},{status:403});
  const b=await request.json();
  const {data,error}=await admin().from('box_timeline').insert({box_id:b.box_id,title:b.title,due_date:b.due_date||null,done:!!b.done}).select().single();
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({item:data});
}
export async function PATCH(request){
  if(!(await gate(request))) return NextResponse.json({error:'forbidden'},{status:403});
  const b=await request.json(); if(!b.id) return NextResponse.json({error:'id'},{status:400});
  const patch={};
  for(const f of ['title','due_date']) if(f in b) patch[f]=b[f]===''?null:b[f];
  if('done' in b) patch.done=!!b.done;
  await admin().from('box_timeline').update(patch).eq('id',b.id);
  return NextResponse.json({ok:true});
}
export async function DELETE(request){
  if(!(await gate(request))) return NextResponse.json({error:'forbidden'},{status:403});
  const id=new URL(request.url).searchParams.get('id');
  await admin().from('box_timeline').delete().eq('id',id);
  return NextResponse.json({ok:true});
}
