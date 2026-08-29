create or replace function public.match_embeddings(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count integer
)
returns table (
  source_id uuid,
  source_type text,
  content text,
  similarity double precision
)
language sql
stable
as $$
  select
    e.source_id,
    e.source_type,
    e.content,
    (1 - (e.embedding <=> query_embedding))::double precision as similarity
  from public.embeddings e
  where e.user_id = match_user_id
    and e.embedding is not null
  order by e.embedding <=> query_embedding
  limit match_count;
$$;
