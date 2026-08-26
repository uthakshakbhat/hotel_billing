-- Run this in the Supabase SQL editor, after 002_bharatpe_integration.sql.

-- Marks whether an order came from the app (a bill was printed) or was
-- auto-created directly from a BharatPe payment that didn't match any
-- open printed bill (the "too busy to print" case).
alter table orders
  add column if not exists source text not null default 'app';

alter table orders drop constraint if exists orders_source_check;
alter table orders add constraint orders_source_check check (source in ('app', 'bharatpe'));

-- table_number has no meaning for a 'bharatpe'-source order (no table was
-- ever assigned) — the edge function inserts 0 as a harmless placeholder;
-- the app displays "BharatPe" instead of "Table 0" for these based on the
-- source column, not the number itself.
