-- ============================================================
-- Wine Club Manager - feature additions
-- Safe to run on the existing database (additive only).
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- ============================================================

-- Optional tasting note per wine, shown to members once a box is revealed.
alter table box_items add column if not exists tasting_note text;

-- A member skipping a specific upcoming box.
create table if not exists box_skips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  member_id uuid references members(id) on delete cascade,
  box_id uuid references boxes(id) on delete cascade,
  unique (member_id, box_id)
);
alter table box_skips enable row level security;
