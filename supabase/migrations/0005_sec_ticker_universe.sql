-- SEC company universe on shared entities.
-- entities.exchange and entities.aliases already exist from 0001.

alter table public.entities
  add column if not exists cik text;

alter table public.entities
  add column if not exists source text not null default 'user';

alter table public.entities
  drop constraint if exists entities_source_check;

alter table public.entities
  add constraint entities_source_check check (source in ('sec', 'user'));

alter table public.entities
  add column if not exists last_synced_at timestamptz;

create unique index if not exists entities_company_ticker_upper_unique
  on public.entities (upper(ticker))
  where entity_type = 'company' and ticker is not null;

create or replace function public.lookup_company(q text)
returns table (
  id uuid,
  ticker text,
  canonical_name text,
  aliases jsonb,
  exchange text,
  cik text,
  source text
)
language sql
stable
security invoker
set search_path = public
as $$
  select e.id, e.ticker, e.canonical_name, e.aliases, e.exchange, e.cik, e.source
  from public.entities e
  where e.entity_type = 'company'
    and q is not null
    and length(trim(q)) > 0
    and (
      upper(e.ticker) = upper(trim(q))
      or exists (
        select 1
        from jsonb_array_elements_text(e.aliases) a
        where upper(a) = upper(trim(q))
      )
    )
  order by case when upper(e.ticker) = upper(trim(q)) then 0 else 1 end
  limit 1;
$$;

create or replace function public.search_companies(q text, lim integer default 8)
returns table (
  id uuid,
  ticker text,
  canonical_name text,
  aliases jsonb,
  exchange text,
  cik text,
  source text
)
language sql
stable
security invoker
set search_path = public
as $$
  select e.id, e.ticker, e.canonical_name, e.aliases, e.exchange, e.cik, e.source
  from public.entities e
  where e.entity_type = 'company'
    and q is not null
    and length(trim(q)) > 0
    and (
      e.ticker ilike trim(q) || '%'
      or e.canonical_name ilike '%' || trim(q) || '%'
      or exists (
        select 1
        from jsonb_array_elements_text(e.aliases) a
        where a ilike '%' || trim(q) || '%'
      )
    )
  order by
    case
      when upper(e.ticker) = upper(trim(q)) then 0
      when e.ticker ilike trim(q) || '%' then 1
      else 2
    end,
    e.canonical_name
  limit least(greatest(coalesce(lim, 8), 1), 20);
$$;

create or replace function public.search_companies_by_name(q text)
returns table (
  id uuid,
  ticker text,
  canonical_name text,
  aliases jsonb,
  exchange text,
  cik text,
  source text
)
language sql
stable
security invoker
set search_path = public
as $$
  select e.id, e.ticker, e.canonical_name, e.aliases, e.exchange, e.cik, e.source
  from public.entities e
  where e.entity_type = 'company'
    and q is not null
    and length(trim(q)) > 0
    and (
      e.canonical_name ilike '%' || trim(q) || '%'
      or exists (
        select 1
        from jsonb_array_elements_text(e.aliases) a
        where a ilike '%' || trim(q) || '%'
      )
    )
  limit 40;
$$;

revoke all on function public.lookup_company(text) from public;
revoke all on function public.search_companies(text, integer) from public;
revoke all on function public.search_companies_by_name(text) from public;

grant execute on function public.lookup_company(text) to authenticated, service_role;
grant execute on function public.search_companies(text, integer) to authenticated, service_role;
grant execute on function public.search_companies_by_name(text) to authenticated, service_role;
