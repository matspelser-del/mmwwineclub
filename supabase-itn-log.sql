-- ============================================================
-- Wine Club Manager - ITN (Payfast webhook) log
-- Safe to run on the existing database (additive only).
-- Records every Payfast notification, including ones that fail the
-- signature or validation check, so a payment is never silently lost.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- ============================================================

create table if not exists itn_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  email text,
  m_payment_id text,
  pf_payment_id text,
  payment_status text,
  amount numeric,
  signature_ok boolean,
  validated boolean,
  result text,            -- 'accepted' | 'bad signature' | 'not validated'
  raw jsonb               -- the full ITN payload Payfast sent
);
alter table itn_log enable row level security;

-- Quick way to find failures: a payment Payfast sent that the app rejected.
-- select created_at, email, amount, result from itn_log where result <> 'accepted' order by created_at desc;
