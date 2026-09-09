create table if not exists public.note_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  url text not null,
  canonical_url text,
  title text,
  description text,
  image_url text,
  fetch_status text not null default 'pending'
    check (fetch_status in ('pending', 'ready', 'failed')),
  fetch_error text,
  created_at timestamptz not null default now(),
  unique (note_id, url)
);

create index if not exists note_links_note_idx on public.note_links (note_id);

alter table public.note_links enable row level security;

create policy "note_links_owner" on public.note_links
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
