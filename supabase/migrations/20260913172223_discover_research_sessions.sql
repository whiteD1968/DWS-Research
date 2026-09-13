create table public.research_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  query text not null,
  filters jsonb not null default '{}'::jsonb,
  status text not null default 'completed',
  result_snapshot jsonb not null default '[]'::jsonb,
  saved_items jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index research_sessions_owner_created_idx on public.research_sessions(owner_id, created_at desc);
create trigger set_research_sessions_updated_at before update on public.research_sessions
for each row execute function public.set_updated_at();
alter table public.research_sessions enable row level security;
create policy "Owner manages research sessions" on public.research_sessions for all to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, update, delete on public.research_sessions to authenticated;

-- One transaction and owner lock make batch retries and concurrent imports idempotent.
create function public.import_discover_results(session_id uuid, result_ids text[], collection_id uuid default null, collection_title text default null, source_matches jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
  session_row public.research_sessions;
  item jsonb;
  source_uuid uuid;
  reference_uuid uuid;
  destination uuid := collection_id;
  imported jsonb := '{}'::jsonb;
  provenance jsonb;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  select * into session_row from public.research_sessions where id = session_id and owner_id = uid for update;
  if not found then raise exception 'Research session unavailable'; end if;
  if coalesce(cardinality(result_ids), 0) not between 1 and 20 then raise exception 'Select 1 to 20 results'; end if;
  if exists (select 1 from unnest(result_ids) selected where not exists (
    select 1 from jsonb_array_elements(session_row.result_snapshot) r where r->>'id' = selected
  )) then raise exception 'Unknown result'; end if;
  if destination is not null and not exists(select 1 from public.collections c where c.id = destination and c.owner_id = uid)
    then raise exception 'Collection unavailable'; end if;
  if destination is null and nullif(trim(collection_title), '') is not null then
    insert into public.collections(owner_id, title) values(uid, left(trim(collection_title), 200)) returning id into destination;
  end if;
  for item in select value from jsonb_array_elements(session_row.result_snapshot) where value->>'id' = any(result_ids) loop
    source_uuid := null;
    reference_uuid := null;
    select s.id into source_uuid from public.sources s where s.owner_id = uid
      and (s.url = item->>'url' or s.metadata->>'normalized_url' = item->>'url'
        or s.id::text = source_matches->>(item->>'url')) order by s.created_at limit 1;
    select r.id into reference_uuid from public."references" r where r.owner_id = uid and (
      r.id::text = session_row.saved_items->>(item->>'id') or
      r.primary_source_id = source_uuid or
      r.metadata->>'normalized_url' = item->>'url' or
      lower(regexp_replace(trim(r.title), '[[:space:][:punct:]]+', '', 'g')) =
        lower(regexp_replace(trim(item->>'title'), '[[:space:][:punct:]]+', '', 'g'))
    ) order by r.created_at limit 1;
    if reference_uuid is null then
      provenance := jsonb_build_object('normalized_url', item->>'url', 'discover_session_id', session_id,
        'accessed_at', now(), 'original_result_type', item->>'resultType', 'external_result', item);
      if source_uuid is null then
        insert into public.sources(owner_id, source_type, title, url, creator, metadata)
          values(uid, 'web', item->>'title', item->>'url', item->>'creator', provenance) returning id into source_uuid;
      end if;
      insert into public."references"(owner_id, title, reference_type, creator, reference_date, location,
        description, why_saved, primary_source_id, metadata)
      values(uid, item->>'title', coalesce(item->>'resultType', 'article'), item->>'creator', item->>'publishedAt',
        item->>'location', item->>'summary', item->>'relevanceReason', source_uuid, provenance) returning id into reference_uuid;
    end if;
    if destination is not null then
      insert into public.collection_items(owner_id, collection_id, record_type, record_id, sort_order)
      values(uid, destination, 'reference', reference_uuid,
        (select coalesce(max(ci.sort_order), -1) + 1 from public.collection_items ci where ci.collection_id = destination))
      on conflict do nothing;
    end if;
    imported := imported || jsonb_build_object(item->>'id', reference_uuid);
  end loop;
  update public.research_sessions set saved_items = saved_items || imported where id = session_id and owner_id = uid;
  return jsonb_build_object('savedItems', imported, 'collectionId', destination);
end;
$$;
revoke all on function public.import_discover_results(uuid, text[], uuid, text, jsonb) from public, anon;
grant execute on function public.import_discover_results(uuid, text[], uuid, text, jsonb) to authenticated;
