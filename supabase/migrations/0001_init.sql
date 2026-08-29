create extension if not exists "pgcrypto";
create extension if not exists "vector";

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.source_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  asset_type text not null check (asset_type in ('handwritten_image', 'audio', 'attachment')),
  storage_path text not null,
  mime_type text,
  original_filename text,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text,
  document_type text not null default 'longform'
    check (document_type in ('longform', 'ai_research_session', 'research_session')),
  raw_content text not null,
  interpreted_content text,
  source text,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'ready', 'failed', 'needs_review')),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  source_type text not null
    check (source_type in ('typed', 'dictated', 'handwritten_image', 'ai_import', 'longform')),
  raw_text text,
  original_raw_text text,
  interpreted_text text,
  literal_transcription text,
  uncertain_segments jsonb not null default '[]'::jsonb,
  title text,
  note_kind text check (note_kind in ('quick', 'research', 'thinking', 'question', 'observation', 'mixed')),
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'ready', 'failed', 'needs_review')),
  ai_confidence numeric,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_asset_id uuid references public.source_assets (id) on delete set null,
  parent_document_id uuid references public.documents (id) on delete set null
);

create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('company', 'person', 'industry')),
  canonical_name text not null,
  ticker text,
  exchange text,
  aliases jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, canonical_name)
);

create unique index if not exists entities_ticker_unique
  on public.entities (ticker)
  where ticker is not null;

create table if not exists public.note_entities (
  note_id uuid not null references public.notes (id) on delete cascade,
  entity_id uuid not null references public.entities (id) on delete cascade,
  relationship_type text not null default 'mentioned',
  confidence numeric,
  created_at timestamptz not null default now(),
  primary key (note_id, entity_id, relationship_type)
);

create table if not exists public.document_entities (
  document_id uuid not null references public.documents (id) on delete cascade,
  entity_id uuid not null references public.entities (id) on delete cascade,
  relationship_type text not null default 'mentioned',
  confidence numeric,
  created_at timestamptz not null default now(),
  primary key (document_id, entity_id, relationship_type)
);

create table if not exists public.themes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  normalized_name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'suggested', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_name)
);

create table if not exists public.note_themes (
  note_id uuid not null references public.notes (id) on delete cascade,
  theme_id uuid not null references public.themes (id) on delete cascade,
  confidence numeric,
  created_at timestamptz not null default now(),
  primary key (note_id, theme_id)
);

create table if not exists public.document_themes (
  document_id uuid not null references public.documents (id) on delete cascade,
  theme_id uuid not null references public.themes (id) on delete cascade,
  confidence numeric,
  created_at timestamptz not null default now(),
  primary key (document_id, theme_id)
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  note_id uuid references public.notes (id) on delete cascade,
  document_id uuid references public.documents (id) on delete cascade,
  entity_id uuid references public.entities (id) on delete set null,
  theme_id uuid references public.themes (id) on delete set null,
  claim_text text not null,
  claim_type text not null check (claim_type in (
    'fact', 'management_claim', 'external_claim', 'observation',
    'inference', 'thesis', 'risk', 'counterargument'
  )),
  confidence numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  note_id uuid references public.notes (id) on delete cascade,
  document_id uuid references public.documents (id) on delete cascade,
  question_text text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  note_id uuid references public.notes (id) on delete cascade,
  document_id uuid references public.documents (id) on delete cascade,
  text text not null,
  status text not null default 'open' check (status in ('open', 'completed', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.meta_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  meta_type text not null check (meta_type in ('daily', 'company', 'theme')),
  entity_id uuid references public.entities (id) on delete cascade,
  theme_id uuid references public.themes (id) on delete cascade,
  date date,
  title text not null,
  current_content text not null default '',
  user_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists meta_notes_daily_unique
  on public.meta_notes (user_id, date)
  where meta_type = 'daily';

create unique index if not exists meta_notes_company_unique
  on public.meta_notes (user_id, entity_id)
  where meta_type = 'company';

create unique index if not exists meta_notes_theme_unique
  on public.meta_notes (user_id, theme_id)
  where meta_type = 'theme';

create table if not exists public.meta_note_versions (
  id uuid primary key default gen_random_uuid(),
  meta_note_id uuid not null references public.meta_notes (id) on delete cascade,
  version_number integer not null,
  content text not null,
  change_summary text,
  source_note_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (meta_note_id, version_number)
);

create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  job_type text not null,
  object_type text not null,
  object_id uuid not null,
  provider text not null default 'gemini',
  model text,
  prompt_version text,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric,
  latency_ms integer,
  error_message text,
  diagnostics jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  source_type text not null check (source_type in ('note', 'document', 'meta_note')),
  source_id uuid not null,
  chunk_index integer not null default 0,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists embeddings_source_chunk_unique
  on public.embeddings (user_id, source_type, source_id, chunk_index);

create index if not exists embeddings_vector_idx
  on public.embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  category text not null check (category in (
    'needs_interpretation', 'ambiguous_entity', 'processing_failed', 'suggested_theme'
  )),
  title text not null,
  body text,
  object_type text,
  object_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_captured_idx on public.notes (user_id, captured_at desc);
create index if not exists notes_fts_idx on public.notes using gin (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(raw_text, '') || ' ' || coalesce(interpreted_text, ''))
);
create index if not exists documents_user_captured_idx on public.documents (user_id, captured_at desc);
create index if not exists questions_user_status_idx on public.questions (user_id, status);
create index if not exists followups_user_status_idx on public.followups (user_id, status);
create index if not exists inbox_user_status_idx on public.inbox_items (user_id, status, created_at desc);

alter table public.users enable row level security;
alter table public.source_assets enable row level security;
alter table public.documents enable row level security;
alter table public.notes enable row level security;
alter table public.entities enable row level security;
alter table public.note_entities enable row level security;
alter table public.document_entities enable row level security;
alter table public.themes enable row level security;
alter table public.note_themes enable row level security;
alter table public.document_themes enable row level security;
alter table public.claims enable row level security;
alter table public.questions enable row level security;
alter table public.followups enable row level security;
alter table public.meta_notes enable row level security;
alter table public.meta_note_versions enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.embeddings enable row level security;
alter table public.inbox_items enable row level security;

create policy "users_self" on public.users
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "source_assets_owner" on public.source_assets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "documents_owner" on public.documents
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notes_owner" on public.notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "entities_read_authenticated" on public.entities
  for select using (auth.role() = 'authenticated');

create policy "note_entities_owner" on public.note_entities
  for all using (
    exists (select 1 from public.notes n where n.id = note_id and n.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.notes n where n.id = note_id and n.user_id = auth.uid())
  );

create policy "document_entities_owner" on public.document_entities
  for all using (
    exists (select 1 from public.documents d where d.id = document_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.documents d where d.id = document_id and d.user_id = auth.uid())
  );

create policy "themes_owner" on public.themes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "note_themes_owner" on public.note_themes
  for all using (
    exists (select 1 from public.notes n where n.id = note_id and n.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.notes n where n.id = note_id and n.user_id = auth.uid())
  );

create policy "document_themes_owner" on public.document_themes
  for all using (
    exists (select 1 from public.documents d where d.id = document_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.documents d where d.id = document_id and d.user_id = auth.uid())
  );

create policy "claims_owner" on public.claims
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "questions_owner" on public.questions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "followups_owner" on public.followups
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "meta_notes_owner" on public.meta_notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "meta_note_versions_owner" on public.meta_note_versions
  for all using (
    exists (select 1 from public.meta_notes m where m.id = meta_note_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.meta_notes m where m.id = meta_note_id and m.user_id = auth.uid())
  );

create policy "ai_jobs_owner" on public.ai_jobs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "embeddings_owner" on public.embeddings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "inbox_owner" on public.inbox_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('source-assets', 'source-assets', false)
on conflict (id) do nothing;

create policy "source_assets_storage_select"
  on storage.objects for select
  using (bucket_id = 'source-assets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "source_assets_storage_insert"
  on storage.objects for insert
  with check (bucket_id = 'source-assets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "source_assets_storage_update"
  on storage.objects for update
  using (bucket_id = 'source-assets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "source_assets_storage_delete"
  on storage.objects for delete
  using (bucket_id = 'source-assets' and (storage.foldername(name))[1] = auth.uid()::text);
