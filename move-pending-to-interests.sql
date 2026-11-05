-- Move pending NON-PAYERS into the interest list and out of members.
-- Run supabase-interests.sql first (it creates the interests table).

-- 1. See who will move (review before running step 2/3).
select id, email, name, tier, seats, created_at
from members
where status = 'pending' and (payfast_token is null or payfast_token = '')
order by created_at desc;

-- 2. Copy them into interests. ON CONFLICT skips anyone already on the list.
insert into interests (email, name, phone, tier, seats, addr_line1, addr_line2, city, province, postal_code, country, status, created_at)
  select lower(email), name, phone, tier, seats, addr_line1, addr_line2, city, province, postal_code, country, 'interested', created_at
  from members
  where status = 'pending' and (payfast_token is null or payfast_token = '')
  on conflict (lower(email)) do nothing;

-- 3. Remove them from members.
delete from members
where status = 'pending' and (payfast_token is null or payfast_token = '');

-- 4. LEFT BEHIND ON PURPOSE: pending members WITH a token. These likely paid but
--    the old webhook never activated them. Do NOT move these - activate them
--    (open each in the dashboard, "Onboard & send welcome", confirm the payment).
select id, email, name, payfast_token, created_at
from members
where status = 'pending' and payfast_token is not null and payfast_token <> ''
order by created_at desc;
