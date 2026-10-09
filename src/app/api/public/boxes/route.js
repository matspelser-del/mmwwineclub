import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
export const dynamic = 'force-dynamic';

// PUBLIC, read-only. Returns only boxes that have been revealed (release date
// passed, or marked shipped/done) and only safe fields - no costs, no member
// data. Used by the public wine-club page on the website to show past editions.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=300, s-maxage=300',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function GET() {
  const db = admin();
  const today = new Date().toISOString().slice(0, 10);

  const { data: boxesRaw } = await db.from('boxes')
    .select('id,label,release_date,status,position')
    .neq('status', 'planning').order('position', { ascending: true });
  const boxes = (boxesRaw || []).filter(
    (b) => b.status === 'shipped' || b.status === 'done' || (b.release_date && b.release_date <= today)
  );
  if (!boxes.length) return NextResponse.json({ boxes: [] }, { headers: cors });

  const { data: items } = await db.from('box_items')
    .select('box_id,kind,name,vintage,qty,tasting_note,position')
    .in('box_id', boxes.map((b) => b.id)).order('position', { ascending: true });
  const byBox = {};
  for (const it of items || []) (byBox[it.box_id] = byBox[it.box_id] || []).push(it);

  const out = boxes.map((b) => ({
    label: b.label,
    release_date: b.release_date,
    wines: (byBox[b.id] || []).map((w) => ({
      name: w.name, vintage: w.vintage, qty: w.qty, kind: w.kind, tasting_note: w.tasting_note || null,
    })),
  })).reverse(); // most recent first

  return NextResponse.json({ boxes: out }, { headers: cors });
}
