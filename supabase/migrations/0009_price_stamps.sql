alter table public.note_entities
  add column if not exists price_at_capture numeric,
  add column if not exists price_currency text,
  add column if not exists price_as_of timestamptz,
  add column if not exists price_provider text;
