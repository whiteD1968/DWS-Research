-- Repository-only migration. Apply before enabling the board editor.
create or replace function public.save_research_board(
  p_board_id uuid, p_revision timestamptz, p_snapshot jsonb, p_items jsonb
) returns timestamptz language plpgsql security invoker set search_path = '' as $$
declare current_revision timestamptz; next_revision timestamptz; item jsonb; target_table text; owned boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select updated_at into current_revision from public.boards
    where id = p_board_id and owner_id = auth.uid() for update;
  if not found then raise exception 'Board not found'; end if;
  if current_revision is distinct from p_revision then raise exception 'Board changed in another session. Reload before editing.'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Invalid placements'; end if;
  if jsonb_array_length(p_items) > 500 then raise exception 'Too many placements'; end if;
  if jsonb_typeof(p_snapshot) is distinct from 'object' then raise exception 'Invalid snapshot'; end if;
  if octet_length(p_snapshot::text) > 8000000 then raise exception 'Board snapshot too large'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    target_table := case item->>'record_type'
      when 'reference' then 'references' when 'media' then 'media' when 'note' then 'notes'
      when 'project' then 'projects' when 'collection' then 'collections' when 'theme' then 'relationships' end;
    if target_table is null then raise exception 'Unsupported record type'; end if;
    execute format('select exists(select 1 from public.%I where id = $1 and owner_id = $2)', target_table)
      into owned using (item->>'record_id')::uuid, auth.uid();
    if not owned then raise exception 'Record not found'; end if;
    if item->>'record_type' = 'theme' and not exists (
      select 1 from public.relationships where id = (item->>'record_id')::uuid and owner_id = auth.uid()
        and source_type = 'research_thread' and relationship_type = 'has_theme' and target_type = 'tag'
    ) then raise exception 'Theme not found'; end if;
  end loop;
  update public.boards set snapshot = p_snapshot where id = p_board_id and owner_id = auth.uid()
    returning updated_at into next_revision;
  delete from public.board_items where board_id = p_board_id and owner_id = auth.uid();
  insert into public.board_items (owner_id, board_id, shape_id, record_type, record_id, item_type, x, y, width, height, rotation, z_index, state)
    select auth.uid(), p_board_id, i->>'shape_id', i->>'record_type', (i->>'record_id')::uuid,
      case when i->>'record_type' = 'media' and exists (
        select 1 from public.media m where m.id = (i->>'record_id')::uuid and m.owner_id = auth.uid() and m.mime_type = 'application/pdf'
      ) then 'document' else i->>'item_type' end,
      (i->>'x')::float8, (i->>'y')::float8, (i->>'width')::float8,
      (i->>'height')::float8, (i->>'rotation')::float8, (i->>'z_index')::integer, coalesce(i->'state', '{}'::jsonb)
    from jsonb_array_elements(p_items) i;
  return next_revision;
end;
$$;
revoke all on function public.save_research_board(uuid, timestamptz, jsonb, jsonb) from public, anon;
grant execute on function public.save_research_board(uuid, timestamptz, jsonb, jsonb) to authenticated;
