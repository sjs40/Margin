-- First-class Insights and Frameworks, provenance, typed relationships,
-- embeddings support, context-pack records, and bounded backfill checkpoints.

alter table public.embeddings
  drop constraint if exists embeddings_source_type_check;

alter table public.embeddings
  add constraint embeddings_source_type_check
  check (source_type in ('note', 'document', 'meta_note', 'knowledge_object'));

create table if not exists public.knowledge_objects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null check (kind in ('insight', 'framework')),
  title text not null,
  summary text not null,
  body text not null default '',
  state text not null default 'proposed'
    check (state in ('proposed', 'active', 'archived', 'merged')),
  maturity text
    check (maturity is null or maturity in ('emerging', 'developing', 'well_supported', 'challenged')),
  origin text not null default 'ai'
    check (origin in ('user', 'ai', 'develop', 'import', 'backfill')),
  user_edited boolean not null default false,
  merged_into_id uuid references public.knowledge_objects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (merged_into_id is distinct from id)
);

create table if not exists public.knowledge_object_versions (
  id uuid primary key default gen_random_uuid(),
  knowledge_object_id uuid not null references public.knowledge_objects (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  version_number integer not null,
  title text not null,
  summary text not null,
  body text not null,
  change_summary text,
  origin text not null
    check (origin in ('user', 'ai', 'develop', 'import', 'backfill', 'merge')),
  develop_session_id uuid,
  created_at timestamptz not null default now(),
  unique (knowledge_object_id, version_number)
);

create table if not exists public.knowledge_object_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  knowledge_object_id uuid not null references public.knowledge_objects (id) on delete cascade,
  source_type text not null
    check (source_type in ('note', 'document', 'meta_note', 'claim', 'knowledge_object')),
  source_id uuid not null,
  role text not null
    check (role in ('origin', 'support', 'counterevidence', 'example', 'counterexample', 'boundary_condition')),
  excerpt text,
  rationale text,
  confidence numeric,
  created_by text not null default 'ai' check (created_by in ('user', 'ai')),
  created_at timestamptz not null default now(),
  unique (knowledge_object_id, source_type, source_id, role)
);

create table if not exists public.knowledge_object_entities (
  knowledge_object_id uuid not null references public.knowledge_objects (id) on delete cascade,
  entity_id uuid not null references public.entities (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (knowledge_object_id, entity_id)
);

create table if not exists public.knowledge_object_themes (
  knowledge_object_id uuid not null references public.knowledge_objects (id) on delete cascade,
  theme_id uuid not null references public.themes (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (knowledge_object_id, theme_id)
);

create table if not exists public.knowledge_relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  from_object_id uuid not null references public.knowledge_objects (id) on delete cascade,
  to_object_id uuid not null references public.knowledge_objects (id) on delete cascade,
  relation_type text not null
    check (relation_type in (
      'instance_of', 'supports', 'contradicts', 'extends', 'refines',
      'same_mechanism', 'boundary_condition', 'related'
    )),
  explanation text not null,
  confidence numeric,
  state text not null default 'proposed'
    check (state in ('proposed', 'accepted', 'rejected')),
  created_by text not null default 'ai' check (created_by in ('user', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_object_id <> to_object_id),
  unique (from_object_id, to_object_id, relation_type)
);

create table if not exists public.context_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  seed_type text not null
    check (seed_type in (
      'note', 'document', 'meta_note', 'company', 'theme',
      'insight', 'framework', 'question', 'followup'
    )),
  seed_id uuid not null,
  size text not null check (size in ('compact', 'standard', 'deep')),
  objective text,
  selected_sources jsonb not null default '[]'::jsonb,
  token_estimate integer,
  prompt_version text,
  markdown text,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_backfill_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  status text not null default 'dry_run'
    check (status in ('dry_run', 'running', 'completed', 'failed', 'cancelled')),
  dry_run boolean not null default true,
  cursor_note_captured_at timestamptz,
  cursor_note_id uuid,
  cursor_document_captured_at timestamptz,
  cursor_document_id uuid,
  estimated_notes integer not null default 0,
  estimated_documents integer not null default 0,
  processed_count integer not null default 0,
  proposed_count integer not null default 0,
  skipped_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_objects_user_kind_state_idx
  on public.knowledge_objects (user_id, kind, state, updated_at desc);

create index if not exists knowledge_objects_user_updated_idx
  on public.knowledge_objects (user_id, updated_at desc);

create index if not exists knowledge_object_sources_lookup_idx
  on public.knowledge_object_sources (user_id, source_type, source_id);

create index if not exists knowledge_object_sources_object_idx
  on public.knowledge_object_sources (knowledge_object_id, role);

create index if not exists knowledge_object_entities_entity_idx
  on public.knowledge_object_entities (user_id, entity_id);

create index if not exists knowledge_object_themes_theme_idx
  on public.knowledge_object_themes (user_id, theme_id);

create index if not exists knowledge_relationships_from_idx
  on public.knowledge_relationships (user_id, from_object_id, state);

create index if not exists knowledge_relationships_to_idx
  on public.knowledge_relationships (user_id, to_object_id, state);

create index if not exists context_packs_user_created_idx
  on public.context_packs (user_id, created_at desc);

create index if not exists knowledge_backfill_runs_user_idx
  on public.knowledge_backfill_runs (user_id, created_at desc);

alter table public.knowledge_objects enable row level security;
alter table public.knowledge_object_versions enable row level security;
alter table public.knowledge_object_sources enable row level security;
alter table public.knowledge_object_entities enable row level security;
alter table public.knowledge_object_themes enable row level security;
alter table public.knowledge_relationships enable row level security;
alter table public.context_packs enable row level security;
alter table public.knowledge_backfill_runs enable row level security;

create policy "knowledge_objects_owner" on public.knowledge_objects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "knowledge_object_versions_owner" on public.knowledge_object_versions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "knowledge_object_sources_owner" on public.knowledge_object_sources
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "knowledge_object_entities_owner" on public.knowledge_object_entities
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "knowledge_object_themes_owner" on public.knowledge_object_themes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "knowledge_relationships_owner" on public.knowledge_relationships
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "context_packs_owner" on public.context_packs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "knowledge_backfill_runs_owner" on public.knowledge_backfill_runs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
