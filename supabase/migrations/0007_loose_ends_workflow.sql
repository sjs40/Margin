alter table public.questions
  add column if not exists resolution_comment text,
  add column if not exists resolved_by_note_id uuid references public.notes (id) on delete set null,
  add column if not exists entity_id uuid references public.entities (id) on delete set null,
  add column if not exists theme_id uuid references public.themes (id) on delete set null,
  add column if not exists source text not null default 'ai';

alter table public.questions
  drop constraint if exists questions_source_check;

alter table public.questions
  add constraint questions_source_check check (source in ('ai', 'user'));

alter table public.followups
  add column if not exists resolution_comment text,
  add column if not exists resolved_by_note_id uuid references public.notes (id) on delete set null,
  add column if not exists entity_id uuid references public.entities (id) on delete set null,
  add column if not exists theme_id uuid references public.themes (id) on delete set null,
  add column if not exists source text not null default 'ai';

alter table public.followups
  drop constraint if exists followups_source_check;

alter table public.followups
  add constraint followups_source_check check (source in ('ai', 'user'));

create index if not exists questions_entity_status_idx on public.questions (entity_id, status);
create index if not exists questions_theme_status_idx on public.questions (theme_id, status);
create index if not exists followups_entity_status_idx on public.followups (entity_id, status);
create index if not exists followups_theme_status_idx on public.followups (theme_id, status);
