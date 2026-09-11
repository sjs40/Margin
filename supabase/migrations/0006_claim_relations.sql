-- Claim status, contradiction relations, inbox category, and per-user pipeline settings.

alter table public.claims
  add column if not exists status text not null default 'active';

alter table public.claims
  drop constraint if exists claims_status_check;

alter table public.claims
  add constraint claims_status_check
  check (status in ('active', 'superseded', 'contradicted', 'retracted'));

create table if not exists public.claim_relations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  claim_id uuid not null references public.claims (id) on delete cascade,
  related_claim_id uuid not null references public.claims (id) on delete cascade,
  relation_type text not null check (relation_type in ('contradicts', 'supersedes', 'supports')),
  explanation text,
  detected_by text not null default 'ai' check (detected_by in ('ai', 'user')),
  user_status text not null default 'pending' check (user_status in ('pending', 'confirmed', 'rejected')),
  created_at timestamptz not null default now(),
  unique (claim_id, related_claim_id, relation_type)
);

alter table public.inbox_items
  drop constraint if exists inbox_items_category_check;

alter table public.inbox_items
  add constraint inbox_items_category_check
  check (category in (
    'needs_interpretation',
    'ambiguous_entity',
    'processing_failed',
    'suggested_theme',
    'contradiction'
  ));

create table if not exists public.user_settings (
  user_id uuid primary key references public.users (id) on delete cascade,
  contradiction_min_confidence numeric not null default 0.7
    check (contradiction_min_confidence between 0.5 and 0.95),
  contradiction_prior_claims_limit integer not null default 50
    check (contradiction_prior_claims_limit between 10 and 200),
  contradiction_detection_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.claim_relations enable row level security;
alter table public.user_settings enable row level security;

create policy "claim_relations_owner" on public.claim_relations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "user_settings_owner" on public.user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists claims_entity_status_idx
  on public.claims (entity_id, status, created_at desc);

create index if not exists claim_relations_user_idx
  on public.claim_relations (user_id, user_status, created_at desc);
