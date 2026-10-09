import { NextResponse } from 'next/server';
import { userFromRequest, isAdminEmail } from '@/lib/auth';
import { admin } from '@/lib/supabaseAdmin';
import { retriggerTag } from '@/lib/mailchimp';
export const dynamic = 'force-dynamic';

const SHIP_TAG = process.env.MAILCHIMP_SHIP_TAG || 'Box On Its Way';

async function gate(request) {
  const u = await userFromRequest(request);
  return (u && isAdminEmail(u.email)) ? u : null;
}

// Tag active members (minus those who skipped this box) so the Mailchimp
// "Box On Its Way" journey fires. retriggerTag removes then re-adds the tag so
// it fires again each quarter. Never emails directly - Mailchimp does the send.
export async function POST(request) {
  if (!(await gate(request))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { box_id } = await request.json();
  if (!box_id) return NextResponse.json({ error: 'box_id required' }, { status: 400 });

  const db = admin();
  const { data: box } = await db.from('boxes').select('id').eq('id', box_id).single();
  if (!box) return NextResponse.json({ error: 'box not found' }, { status: 404 });

  const { data: members } = await db.from('members').select('id,email,status').eq('status', 'active');
  const { data: sk } = await db.from('box_skips').select('member_id').eq('box_id', box_id);
  const skipped = new Set((sk || []).map((s) => s.member_id));

  const targets = (members || []).filter((m) => m.email && !skipped.has(m.id));
  let sent = 0; const failed = [];
  for (const m of targets) {
    try { await retriggerTag(m.email, SHIP_TAG); sent++; }
    catch (e) { failed.push({ email: m.email, error: e.message }); }
  }
  return NextResponse.json({ ok: true, sent, failed, tag: SHIP_TAG });
}
