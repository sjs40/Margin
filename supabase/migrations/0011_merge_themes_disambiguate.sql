-- questions.source / followups.source made merge_themes(source, ...) ambiguous.

create or replace function public.merge_themes(source uuid, target uuid, owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  src public.themes%rowtype;
  tgt public.themes%rowtype;
  src_meta public.meta_notes%rowtype;
  tgt_meta public.meta_notes%rowtype;
  next_ver integer;
  v_source uuid := source;
  v_target uuid := target;
  v_owner uuid := owner;
begin
  if v_source is null or v_target is null or v_owner is null then
    raise exception 'missing merge arguments';
  end if;
  if v_source = v_target then
    raise exception 'cannot merge a theme into itself';
  end if;

  select * into src from public.themes where id = v_source and user_id = v_owner for update;
  select * into tgt from public.themes where id = v_target and user_id = v_owner for update;
  if src.id is null or tgt.id is null then
    raise exception 'theme not found';
  end if;

  delete from public.note_themes nt
  using public.note_themes keep
  where nt.theme_id = v_source
    and keep.theme_id = v_target
    and keep.note_id = nt.note_id;
  update public.note_themes set theme_id = v_target where theme_id = v_source;

  delete from public.document_themes dt
  using public.document_themes keep
  where dt.theme_id = v_source
    and keep.theme_id = v_target
    and keep.document_id = dt.document_id;
  update public.document_themes set theme_id = v_target where theme_id = v_source;

  update public.claims set theme_id = v_target where theme_id = v_source and user_id = v_owner;
  update public.questions set theme_id = v_target where theme_id = v_source and user_id = v_owner;
  update public.followups set theme_id = v_target where theme_id = v_source and user_id = v_owner;

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
  where id = v_target;

  update public.themes
  set status = 'archived', merged_into_theme_id = v_target, updated_at = now()
  where id = v_source;

  select * into src_meta
  from public.meta_notes
  where user_id = v_owner and meta_type = 'theme' and theme_id = v_source;
  select * into tgt_meta
  from public.meta_notes
  where user_id = v_owner and meta_type = 'theme' and theme_id = v_target;

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
    set theme_id = v_target, needs_refresh = true, updated_at = now()
    where id = src_meta.id;
  elsif tgt_meta.id is not null then
    update public.meta_notes
    set needs_refresh = true, updated_at = now()
    where id = tgt_meta.id;
  end if;
end;
$$;
