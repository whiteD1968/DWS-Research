-- Remove a record and its polymorphic links in one transaction. Shared content survives.
create or replace function public.delete_research_content(p_kind text, p_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare target_table text; record_owner uuid; theme_ids uuid[]; removed_keys text[] := array[p_kind || ':' || p_id::text];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  target_table := case p_kind when 'project' then 'projects' when 'reference' then 'references'
    when 'collection' then 'collections' when 'research_thread' then 'research_threads'
    when 'board' then 'boards' when 'media' then 'media' when 'note' then 'notes'
    when 'research_session' then 'research_sessions' end;
  if target_table is null then raise exception 'Unsupported content type'; end if;
  execute format('select owner_id from public.%I where id = $1 and owner_id = $2 for update', target_table)
    into record_owner using p_id, auth.uid();
  if record_owner is null then raise exception 'Content unavailable'; end if;

  if p_kind = 'research_thread' then
    select array_agg(id) into theme_ids from public.relationships where owner_id = auth.uid()
      and source_type = 'research_thread' and source_id = p_id and relationship_type = 'has_theme';
    delete from public.relationships where owner_id = auth.uid() and source_type = 'research_topic_theme' and source_id = any(theme_ids);
    update public.boards set updated_at = clock_timestamp() where owner_id = auth.uid() and id in
      (select board_id from public.board_items where owner_id = auth.uid() and record_type = 'theme' and record_id = any(theme_ids));
    delete from public.board_items where owner_id = auth.uid() and record_type = 'theme' and record_id = any(theme_ids);
  end if;
  if theme_ids is not null then
    removed_keys := removed_keys || array(select 'theme:' || t::text from unnest(theme_ids) t);
  end if;
  -- Unopened generated boards initialize from their composition, not a saved snapshot.
  update public.boards b set metadata = jsonb_set(b.metadata, '{composition,placements}',
    coalesce((select jsonb_agg(p) from jsonb_array_elements(b.metadata #> '{composition,placements}') p
      where not (p->>'key' = any(removed_keys))), '[]'::jsonb))
    where b.owner_id = auth.uid() and jsonb_typeof(b.metadata #> '{composition,placements}') = 'array'
      and exists (select 1 from jsonb_array_elements(b.metadata #> '{composition,placements}') p where p->>'key' = any(removed_keys));
  update public.boards set updated_at = clock_timestamp() where owner_id = auth.uid() and id in
    (select board_id from public.board_items where owner_id = auth.uid() and record_type = p_kind and record_id = p_id);
  delete from public.board_items where owner_id = auth.uid() and record_type = p_kind and record_id = p_id;
  delete from public.collection_items where owner_id = auth.uid() and record_type = p_kind and record_id = p_id;
  delete from public.record_tags where owner_id = auth.uid() and record_type = p_kind and record_id = p_id;
  delete from public.relationships where owner_id = auth.uid() and
    ((source_type = p_kind and source_id = p_id) or (target_type = p_kind and target_id = p_id));
  update public.notes set parent_type = null, parent_id = null where owner_id = auth.uid() and parent_type = p_kind and parent_id = p_id;
  -- Explicit evolution nodes retain their diagram position but no longer target a deleted record.
  update public.lineage_nodes set record_type = null, record_id = null where owner_id = auth.uid() and record_type = p_kind and record_id = p_id;
  if p_kind = 'reference' then
    update public.research_sessions s set saved_items = coalesce((select jsonb_object_agg(key, value)
      from jsonb_each(s.saved_items) where value <> to_jsonb(p_id::text)), '{}'::jsonb)
      where owner_id = auth.uid() and exists (select 1 from jsonb_each(s.saved_items) where value = to_jsonb(p_id::text));
  end if;
  if p_kind in ('collection', 'research_session') then
    update public.boards set metadata = metadata - 'source_id' - 'generated_from'
      where owner_id = auth.uid() and metadata->>'source_id' = p_id::text
        and metadata->>'generated_from' = case p_kind when 'collection' then 'collection' else 'discover' end;
  end if;
  execute format('delete from public.%I where id = $1 and owner_id = $2', target_table) using p_id, auth.uid();
end;
$$;
revoke all on function public.delete_research_content(text, uuid) from public, anon;
grant execute on function public.delete_research_content(text, uuid) to authenticated;
