create table if not exists public.app_settings (
  id integer primary key default 1 check (id = 1),
  hosted_ai_enabled boolean not null default true,
  hosted_ai_daily_limit integer not null default 5,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users (id)
);

insert into public.app_settings (id, hosted_ai_enabled, hosted_ai_daily_limit)
values (1, true, 5)
on conflict (id) do nothing;

create table if not exists public.user_ai_keys (
  user_id uuid primary key references public.users (id) on delete cascade,
  gemini_api_key_encrypted text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_daily_usage (
  user_id uuid not null references public.users (id) on delete cascade,
  usage_date date not null,
  action_count integer not null default 0,
  primary key (user_id, usage_date)
);

alter table public.app_settings enable row level security;
alter table public.user_ai_keys enable row level security;
alter table public.ai_daily_usage enable row level security;

create policy "app_settings_read_authenticated" on public.app_settings
  for select using (auth.role() = 'authenticated');

create policy "ai_daily_usage_self" on public.ai_daily_usage
  for select using (user_id = auth.uid());

create or replace function public.try_consume_hosted_action(p_user_id uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.ai_daily_usage (user_id, usage_date, action_count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, usage_date)
  do update set action_count = public.ai_daily_usage.action_count + 1
  where public.ai_daily_usage.action_count < p_limit
  returning action_count into new_count;
  return new_count is not null;
end;
$$;

revoke all on function public.try_consume_hosted_action(uuid, integer) from public;
grant execute on function public.try_consume_hosted_action(uuid, integer) to service_role;
