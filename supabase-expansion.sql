-- ============================================================
-- Wine Club Manager - expansion: boxes, timeline, wine catalogue
-- Safe to run on the existing database (additive only).
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- ============================================================

-- Upcoming boxes (one per quarter)
create table if not exists boxes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  label text,                       -- e.g. "December 2026"
  release_date date,
  status text default 'planning',   -- planning | confirmed | packing | shipped | done
  price numeric default 2500,       -- what a member pays
  delivery_fee numeric default 0,
  member_note text,                 -- shown to members (no spoilers / no costs)
  notes text,                       -- admin-only
  position int default 0
);

-- Wines / items inside a box
create table if not exists box_items (
  id uuid primary key default gen_random_uuid(),
  box_id uuid references boxes(id) on delete cascade,
  created_at timestamptz default now(),
  kind text default 'wine',         -- wine | extra
  producer text default 'miles',    -- miles | other
  name text,
  vintage text,
  qty int default 1,
  cost_price numeric default 0,     -- what it costs MMW
  cellar_price numeric default 0,   -- cellar-door / retail value
  position int default 0
);

-- Timeline milestones per box
create table if not exists box_timeline (
  id uuid primary key default gen_random_uuid(),
  box_id uuid references boxes(id) on delete cascade,
  created_at timestamptz default now(),
  title text,
  due_date date,
  done boolean default false,
  position int default 0
);

-- Reusable wine catalogue (Miles's range + other producers)
create table if not exists wines (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  producer text default 'miles',    -- miles | other
  name text,
  vintage text,
  cost_price numeric default 0,
  cellar_price numeric default 0,
  active boolean default true
);

alter table boxes        enable row level security;
alter table box_items    enable row level security;
alter table box_timeline enable row level security;
alter table wines        enable row level security;

-- Seed the five upcoming boxes (only if the table is empty)
insert into boxes (label, release_date, status, position)
select * from (values
  ('December 2026',  date '2026-12-01', 'planning', 1),
  ('March 2027',     date '2027-03-01', 'planning', 2),
  ('June 2027',      date '2027-06-01', 'planning', 3),
  ('September 2027', date '2027-09-01', 'planning', 4),
  ('December 2027',  date '2027-12-01', 'planning', 5)
) as v(label, release_date, status, position)
where not exists (select 1 from boxes);

-- Seed Miles's range (EDIT names and fill in prices - these are placeholders)
insert into wines (producer, name, cost_price, cellar_price, active)
select * from (values
  ('miles', 'Saskia',                                   0, 0, true),
  ('miles', 'Max',                                      0, 0, true),
  ('miles', 'Kika',                                     0, 0, true),
  ('miles', 'Chapters Old Vines Stellenbosch Sauvignon Blanc', 0, 0, true),
  ('miles', 'Chapters Cinsault',                        0, 0, true)
) as v(producer, name, cost_price, cellar_price, active)
where not exists (select 1 from wines);
