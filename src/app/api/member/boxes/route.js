import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth';
import { admin } from '@/lib/supabaseAdmin';
export const dynamic = 'force-dynamic';

// A box is "revealed" to members once it has shipped/been delivered, or once its
// release date has passed. Revealed boxes show their line-up; upcoming ones don't.
function isRevealed(b, today) {
  if (b.status === 'shipped' || b.status === 'done') return true;
  return !!b.release_date && b.release_date <= today;
}

export async function GET(request) {
  const u = await userFromRequest(request);
  if (!u) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = admin();

  const { data: member } = await db.from('members').select('id').eq('email', u.email.toLowerCase()).maybeSingle();

  const { data: boxesRaw } = await db.from('boxes')
    .select('id,label,release_date,status,member_note,position')
    .neq('status', 'planning').order('position', { ascending: true });
  const boxes = boxesRaw || [];

  const today = new Date().toISOString().slice(0, 10);
  const revealedIds = boxes.filter((b) => isRevealed(b, today)).map((b) => b.id);

  // line-up only for revealed boxes (no spoilers for upcoming ones)
  let itemsByBox = {};
  if (revealedIds.length) {
    const { data: items } = await db.from('box_items')
      .select('box_id,kind,name,vintage,qty,tasting_note,position')
      .in('box_id', revealedIds).order('position', { ascending: true });
    for (const it of items || []) (itemsByBox[it.box_id] = itemsByBox[it.box_id] || []).push(it);
  }

  // which upcoming boxes this member has skipped
  let skipped = new Set();
  if (member) {
    const { data: sk } = await db.from('box_skips').select('box_id').eq('member_id', member.id);
    skipped = new Set((sk || []).map((s) => s.box_id));
  }

  const upcoming = [];
  const past = [];
  for (const b of boxes) {
    if (isRevealed(b, today)) {
      past.push({ id: b.id, label: b.label, release_date: b.release_date, wines: (itemsByBox[b.id] || []).map((w) => ({ name: w.name, vintage: w.vintage, qty: w.qty, kind: w.kind, tasting_note: w.tasting_note })) });
    } else {
      upcoming.push({ id: b.id, label: b.label, release_date: b.release_date, status: b.status, member_note: b.member_note, skipped: skipped.has(b.id) });
    }
  }
  // most recent past box first
  past.reverse();

  return NextResponse.json({ upcoming, past });
}
