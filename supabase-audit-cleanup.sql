-- AUDIT CLEANUP - read-only diagnostics first. Run each SELECT, review, then
-- decide on the fixes. Nothing here deletes data until you uncomment it.

-- 1. Duplicate members by case-insensitive email (the old webhook could create a
--    second row when the stored email differed only in case).
select lower(email) as email_norm, count(*) as rows, array_agg(id) as ids,
       array_agg(status) as statuses
from members
group by lower(email)
having count(*) > 1
order by rows desc;

-- 2. Duplicate payments for the same Payfast payment id (ITN retries before the
--    idempotency guard was added - these inflate "Payments received").
select payfast_payment_id, count(*) as rows, array_agg(id) as ids, sum(amount) as total
from payments
where payfast_payment_id is not null
group by payfast_payment_id
having count(*) > 1
order by rows desc;

-- 3. Members still 'pending' with no token (likely stranded signups or leads that
--    now belong on the interest list rather than in members).
select id, email, name, status, created_at
from members
where status = 'pending' and (payfast_token is null or payfast_token = '')
order by created_at desc;

-- ---------------------------------------------------------------------------
-- FIXES - run only after reviewing the SELECTs above. Test on a copy if unsure.

-- 3a. Remove duplicate payment rows, keeping the earliest per payfast_payment_id:
-- delete from payments p using payments q
--   where p.payfast_payment_id = q.payfast_payment_id
--     and p.payfast_payment_id is not null
--     and p.created_at > q.created_at;

-- 3b. After you have merged/removed duplicate members by hand (move the token and
--     any payments onto the row you keep, then delete the other), enforce
--     case-insensitive uniqueness so it can never recur. This FAILS until all
--     case-insensitive duplicates are gone, which is the point.
-- create unique index if not exists members_email_ci_key on members (lower(email));
