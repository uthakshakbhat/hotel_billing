-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query).
-- Safe to run once.

-- 1. Extend `orders` with the new payment-state model.
--    status: 'active' (default, counted immediately) | 'missed' (voided,
--    excluded from daily_sales)
--    payment_method: 'cash' | 'upi_pending' | 'upi_confirmed'
alter table orders
  add column if not exists payment_method text not null default 'upi_pending',
  add column if not exists bharatpe_utr text;

-- Backfill existing rows from the old 'printed'/'paid' scheme BEFORE the
-- constraint below locks status down to the new values. Orders that were
-- already manually marked 'paid' under the old flow are assumed UPI
-- (this app's QR is the default payment path) — recheck manually against
-- your ledger if that assumption is wrong for a given day.
update orders set payment_method = 'upi_confirmed' where status = 'paid';
update orders set status = 'active' where status in ('printed', 'paid');

alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check check (status in ('active', 'missed'));

alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check check (payment_method in ('cash', 'upi_pending', 'upi_confirmed'));

-- 2. Every BharatPe transaction the phone app forwards lands here first.
--    The unique constraints (utr, client_event_id) are what make the whole
--    pipeline idempotent — the same payment can never be counted twice
--    even if the phone retries or an SMS gets forwarded more than once.
create table if not exists bharatpe_transactions (
  id bigint generated always as identity primary key,
  utr text unique,
  client_event_id text unique,
  amount numeric not null,
  raw_message text,
  sender text,
  received_at timestamptz not null default now(),
  matched_order_id bigint references orders(id),
  match_method text, -- 'note_reference' | 'amount_time_window' | null (unmatched)
  created_at timestamptz not null default now()
);

-- Transactions with matched_order_id IS NULL are your "needs review" queue
-- automatically — no separate table needed:
--   select * from bharatpe_transactions where matched_order_id is null order by received_at desc;

-- 3. Row Level Security. The edge function uses the service-role key
--    (bypasses RLS) to write; this policy just lets the app's anon key
--    read the table for a "needs review" screen. Tighten the USING clause
--    to your existing user_id pattern if this app ever supports multiple
--    restaurant accounts.
alter table bharatpe_transactions enable row level security;

drop policy if exists "read bharatpe transactions" on bharatpe_transactions;
create policy "read bharatpe transactions" on bharatpe_transactions
  for select using (true);
