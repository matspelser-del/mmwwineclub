-- =====================================================================
-- Wine Club Manager (Pro) - database schema
-- Run in Supabase: SQL Editor -> New query -> paste all -> Run
-- =====================================================================

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  email text unique,
  name text,
  phone text,
  tier text default 'club',            -- 'club' | 'lunch'
  seats int default 1,
  status text default 'pending',       -- 'pending'|'active'|'paused'|'cancelled'
  payfast_token text,
  start_date date,
  -- delivery address (managed by the member in the app)
  addr_line1 text,
  addr_line2 text,
  city text,
  province text,
  postal_code text,
  country text default 'South Africa',
  -- integrations
  discount_code text,
  woo_coupon_id text,
  mailchimp_added boolean default false,
  notes text
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  member_id uuid references members(id) on delete set null,
  amount numeric,
  status text,                         -- 'complete'|'failed'|'cancelled'|'pending'
  payfast_payment_id text,
  payfast_token text,
  item_name text,
  raw jsonb
);

create table if not exists member_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  member_id uuid references members(id) on delete cascade,
  kind text,                           -- 'address_update'|'pause'|'cancel'|'resume'|'note'
  detail text,
  outcome text                         -- 'done'|'pending'|'failed'
);

-- Lock the tables down. All real access is server-side via the service-role
-- key in the app's API routes, so no broad client policies are needed.
alter table members       enable row level security;
alter table payments      enable row level security;
alter table member_events enable row level security;
