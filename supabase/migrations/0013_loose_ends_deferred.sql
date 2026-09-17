-- Deferred Loose Ends and a pointer-only Inbox category.
-- Canonical state stays on questions/followups; Inbox does not duplicate the text.

alter table public.questions
  drop constraint if exists questions_status_check;

alter table public.questions
  add constraint questions_status_check
  check (status in ('open', 'deferred', 'resolved', 'dismissed'));

alter table public.followups
  drop constraint if exists followups_status_check;

alter table public.followups
  add constraint followups_status_check
  check (status in ('open', 'deferred', 'completed', 'dismissed'));

alter table public.inbox_items
  drop constraint if exists inbox_items_category_check;

alter table public.inbox_items
  add constraint inbox_items_category_check
  check (category in (
    'needs_interpretation',
    'ambiguous_entity',
    'processing_failed',
    'suggested_theme',
    'contradiction',
    'loose_end'
  ));

create unique index if not exists inbox_items_open_loose_end_unique
  on public.inbox_items (user_id, object_type, object_id)
  where category = 'loose_end' and status = 'open';
