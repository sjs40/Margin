-- Sample research data. Replace USER_ID after creating an auth user.

-- insert into public.users (id, email) values ('USER_ID', 'analyst@example.com');

insert into public.entities (entity_type, canonical_name, ticker, aliases)
values
  ('company', 'Maplebear', 'CART', '["Instacart"]'::jsonb),
  ('company', 'Uber Technologies', 'UBER', '["Uber"]'::jsonb),
  ('company', 'Alphabet', 'GOOGL', '["Google"]'::jsonb),
  ('company', 'ON Semiconductor', 'ON', '["onsemi"]'::jsonb)
on conflict do nothing;
