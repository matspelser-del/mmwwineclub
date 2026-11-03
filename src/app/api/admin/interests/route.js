import { NextResponse } from 'next/server';
import { userFromRequest, isAdminEmail } from '@/lib/auth';
import { admin } from '@/lib/supabaseAdmin';
export const dynamic = 'force-dynamic';

async function gate(request) {
  const u = await userFromRequest(request);
  return (u && isAdminEmail(u.email)) ? u : null;
}

// Remove an interest (declined, spam, or converted by hand).
export async function DELETE(request) {
  if (!(await gate(request))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await admin().from('interests').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// Mark an interest converted without deleting it (e.g. after adding the member by hand).
export async function PATCH(request) {
  if (!(await gate(request))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await request.json();
  if (!b.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await admin().from('interests')
    .update({ status: 'converted', converted_at: new Date().toISOString() }).eq('id', b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
