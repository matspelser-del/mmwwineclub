-- ============================================================
-- Wine Club Manager - next payment date (from Payfast)
-- Safe to run on the existing database (additive only).
-- Populated by the "Sync next payment dates" button, which reads each
-- member's live subscription from Payfast using their saved token.
-- ============================================================

alter table members add column if not exists next_payment_date date;
alter table members add column if not exists sub_status text;        -- Payfast subscription status text
alter table members add column if not exists sub_synced_at timestamptz;
