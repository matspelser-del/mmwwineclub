-- Audit fixes - safe to run once, idempotent. Run in the Supabase SQL editor.

-- 1. Stop duplicate payment rows at the database level.
--    The webhook pre-checks for an existing pf_payment_id, but that check and the
--    insert are separate steps, so two concurrent Payfast retries could still both
--    insert. This unique index makes the second insert fail instead of duplicating,
--    which keeps "Payments received" and revenue totals correct. Recurring charges
--    get a fresh pf_payment_id each time, so real renewals are unaffected. NULLs are
--    excluded (a payment with no Payfast id does not conflict).
create unique index if not exists payments_pf_payment_id_key
  on payments (payfast_payment_id)
  where payfast_payment_id is not null;

-- 2. Seat-hold timestamp for the launch lunch.
--    Set when someone starts paying, counted as a committed seat for 20 minutes so
--    two people can't both grab the last seat while one is mid-payment. No cleanup
--    job needed - the hold is a time window, not a stored reservation.
alter table interests add column if not exists pay_started_at timestamptz;
