create table if not exists public.note_annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  parent_annotation_id uuid references public.note_annotations (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.note_annotations enable row level security;

create policy "note_annotations_owner" on public.note_annotations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists note_annotations_note_idx
  on public.note_annotations (note_id, created_at);
