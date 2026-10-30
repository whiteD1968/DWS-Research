-- A private calendar feed: a calendar app fetches /calendar/<token> without a session, so this
-- function trades the secret token for a slim list of dated items. It returns only the fields a
-- calendar event needs (never contact details or full note bodies) and nothing for an unknown token.
-- The token lives in the owner's calendar_settings note; resetting it cuts off old subscriptions.
create index if not exists notes_calendar_token_idx on public.notes ((metadata->>'token')) where parent_type = 'calendar_settings';

create or replace function public.calendar_feed(feed_token text)
returns table (id uuid, kind text, title text, detail text, day text, at text, status text, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare feed_owner uuid;
begin
  if feed_token is null or feed_token !~ '^[A-Za-z0-9_-]{32,64}$' then return; end if;
  select n.owner_id into feed_owner from public.notes n
    where n.parent_type = 'calendar_settings' and n.metadata->>'token' = feed_token
    order by n.created_at limit 1;
  if feed_owner is null then return; end if;
  -- One marker row tells the route the token is live even when there is nothing scheduled.
  return query select null::uuid, 'feed'::text, null::text, null::text, null::text, null::text, null::text, now();
  return query
    select n.id, 'deadline'::text, left(coalesce(n.title, ''), 300), left(coalesce(n.metadata->>'organization', ''), 300),
      n.metadata->>'deadline', null::text, n.metadata->>'status', n.updated_at
    from public.notes n
    where n.owner_id = feed_owner and n.parent_type = 'opportunity' and n.metadata->>'deadline' is not null
      and n.metadata->>'status' in ('interested', 'preparing')
    union all
    select n.id, 'follow_up', left(coalesce(n.title, ''), 300), left(coalesce(n.metadata->>'organization', ''), 300),
      n.metadata->>'follow_up', null, null, n.updated_at
    from public.notes n
    where n.owner_id = feed_owner and n.parent_type = 'contact' and n.metadata->>'follow_up' is not null
    union all
    select n.id, 'review', 'Tenure review', null, n.metadata->>'review_date', null, null, n.updated_at
    from public.notes n
    where n.owner_id = feed_owner and n.parent_type = 'dossier_settings' and n.metadata->>'review_date' is not null
    union all
    select n.id, 'reminder', left(coalesce(nullif(n.title, ''), n.plain_text, ''), 300), left(coalesce(case when nullif(n.title, '') is not null then n.plain_text end, ''), 300),
      null, n.metadata->>'remind_at', null, n.updated_at
    from public.notes n
    where n.owner_id = feed_owner and n.metadata->>'remind_at' is not null and n.metadata->>'done_at' is null
      and coalesce(n.parent_type, '') not in ('opportunity', 'contact')
    limit 3000;
end $$;

revoke all on function public.calendar_feed(text) from public;
grant execute on function public.calendar_feed(text) to anon, authenticated;
