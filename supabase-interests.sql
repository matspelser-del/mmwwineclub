-- "Showed interest" list: people who completed the signup form but have not paid.
-- They are NOT members. On a real payment the webhook promotes the matching
-- interest into a members row and marks it converted.
create table if not exists interests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  phone text,
  plan text,                       -- club | lunch1 | lunch2 (what they chose)
  tier text,                       -- club | lunch
  seats int default 1,
  addr_line1 text, addr_line2 text, city text, province text, postal_code text, country text,
  status text default 'interested',   -- interested | converted
  created_at timestamptz default now(),
  converted_at timestamptz
);

-- One interest per email; a re-submitted form updates the same row.
create unique index if not exists interests_email_key on interests (lower(email));

-- Optional: move existing pending members into interests, then remove them from
-- members so the member list holds only paid members. Review first, then run this
-- block on its own if you want the cleanup. It skips anyone with a payfast_token
-- (they have a live subscription and belong in members).
-- insert into interests (email, name, phone, tier, seats, addr_line1, addr_line2, city, province, postal_code, country, created_at)
--   select email, name, phone, tier, seats, addr_line1, addr_line2, city, province, postal_code, country, created_at
--   from members where status = 'pending' and (payfast_token is null or payfast_token = '')
--   on conflict (lower(email)) do nothing;
-- delete from members where status = 'pending' and (payfast_token is null or payfast_token = '');
