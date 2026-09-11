alter table public.themes
  add column if not exists aliases jsonb not null default '[]'::jsonb,
  add column if not exists merged_into_theme_id uuid references public.themes (id) on delete set null;

alter table public.meta_notes
  add column if not exists needs_refresh boolean not null default false;

create or replace function public.merge_themes(source uuid, target uuid, owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  src public.themes%rowtype;
  tgt public.themes%rowtype;
  src_meta public.meta_notes%rowtype;
  tgt_meta public.meta_notes%rowtype;
  next_ver integer;
begin
  if source is null or target is null or owner is null then
    raise exception 'missing merge arguments';
  end if;
  if source = target then
    raise exception 'cannot merge a theme into itself';
  end if;

  select * into src from public.themes where id = source and user_id = owner for update;
  select * into tgt from public.themes where id = target and user_id = owner for update;
  if src.id is null or tgt.id is null then
    raise exception 'theme not found';
  end if;

  delete from public.note_themes nt
  using public.note_themes keep
  where nt.theme_id = source
    and keep.theme_id = target
    and keep.note_id = nt.note_id;
  update public.note_themes set theme_id = target where theme_id = source;

  delete from public.document_themes dt
  using public.document_themes keep
  where dt.theme_id = source
    and keep.theme_id = target
    and keep.document_id = dt.document_id;
  update public.document_themes set theme_id = target where theme_id = source;

  update public.claims set theme_id = target where theme_id = source and user_id = owner;
  update public.questions set theme_id = target where theme_id = source and user_id = owner;
  update public.followups set theme_id = target where theme_id = source and user_id = owner;

  update public.themes
  set
    aliases = (
      select coalesce(jsonb_agg(to_jsonb(value)), '[]'::jsonb)
      from (
        select distinct value
        from jsonb_array_elements_text(coalesce(tgt.aliases, '[]'::jsonb) || jsonb_build_array(src.name)) as value
      ) aliases
    ),
    updated_at = now()
  where id = target;

  update public.themes
  set status = 'archived', merged_into_theme_id = target, updated_at = now()
  where id = source;

  select * into src_meta
  from public.meta_notes
  where user_id = owner and meta_type = 'theme' and theme_id = source;
  select * into tgt_meta
  from public.meta_notes
  where user_id = owner and meta_type = 'theme' and theme_id = target;

  if src_meta.id is not null and tgt_meta.id is not null then
    select coalesce(max(version_number), 0) + 1 into next_ver
    from public.meta_note_versions
    where meta_note_id = tgt_meta.id;
    insert into public.meta_note_versions (
      meta_note_id, version_number, content, change_summary, source_note_ids
    ) values (
      tgt_meta.id, next_ver, src_meta.current_content, 'Merged from ' || src.name, '{}'::uuid[]
    );
    update public.meta_notes
    set needs_refresh = true, updated_at = now()
    where id = tgt_meta.id;
  elsif src_meta.id is not null and tgt_meta.id is null then
    update public.meta_notes
    set theme_id = target, needs_refresh = true, updated_at = now()
    where id = src_meta.id;
  elsif tgt_meta.id is not null then
    update public.meta_notes
    set needs_refresh = true, updated_at = now()
    where id = tgt_meta.id;
  end if;
end;
$$;

revoke all on function public.merge_themes(uuid, uuid, uuid) from public;
grant execute on function public.merge_themes(uuid, uuid, uuid) to authenticated, service_role;
