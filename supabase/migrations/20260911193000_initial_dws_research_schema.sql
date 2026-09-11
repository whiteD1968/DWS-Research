create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  summary text,
  project_type text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.research_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  summary text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  source_type text,
  url text,
  citation text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text,
  bucket_id text not null,
  storage_path text not null,
  mime_type text,
  alt_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public."references" (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  reference_type text not null,
  creator text,
  project_name text,
  reference_date date,
  location text,
  description text,
  why_saved text,
  source_url text,
  source_id uuid references public.sources(id) on delete set null,
  media_id uuid references public.media(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collection_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  item_type text not null,
  item_id uuid not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (collection_id, item_type, item_id)
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.processes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  summary text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.board_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  item_type text not null,
  item_id uuid not null,
  x numeric not null default 0,
  y numeric not null default 0,
  width numeric,
  height numeric,
  created_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text,
  body text not null,
  parent_type text,
  parent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lineage_graphs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lineage_nodes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  graph_id uuid not null references public.lineage_graphs(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  label text,
  created_at timestamptz not null default now()
);

create table public.lineage_edges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  graph_id uuid not null references public.lineage_graphs(id) on delete cascade,
  source_node_id uuid not null references public.lineage_nodes(id) on delete cascade,
  target_node_id uuid not null references public.lineage_nodes(id) on delete cascade,
  relationship_type text not null,
  created_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.record_tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  created_at timestamptz not null default now(),
  unique (record_type, record_id, tag_id)
);

create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  relationship_type text not null,
  target_type text not null,
  target_id uuid not null,
  description text,
  created_at timestamptz not null default now(),
  unique (source_type, source_id, relationship_type, target_type, target_id)
);

create index collection_items_collection_id_idx on public.collection_items(collection_id);
create index collection_items_item_idx on public.collection_items(item_type, item_id);
create index relationships_source_idx on public.relationships(source_type, source_id);
create index relationships_target_idx on public.relationships(target_type, target_id);
create index references_owner_created_at_idx on public."references"(owner_id, created_at desc);
create index projects_owner_created_at_idx on public.projects(owner_id, created_at desc);
create index collections_owner_created_at_idx on public.collections(owner_id, created_at desc);

alter table public.profiles enable row level security;

create policy "Profiles are readable by owner"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

create policy "Profiles are insertable by owner"
on public.profiles for insert
to authenticated
with check (id = (select auth.uid()));

create policy "Profiles are updateable by owner"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'projects',
    'research_threads',
    'sources',
    'media',
    'references',
    'collections',
    'collection_items',
    'materials',
    'processes',
    'experiments',
    'boards',
    'board_items',
    'notes',
    'lineage_graphs',
    'lineage_nodes',
    'lineage_edges',
    'tags',
    'record_tags',
    'relationships'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);

    execute format(
      'create policy %I on public.%I for select to authenticated using (owner_id = (select auth.uid()))',
      'Owner can read ' || table_name,
      table_name
    );

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (owner_id = (select auth.uid()))',
      'Owner can insert ' || table_name,
      table_name
    );

    execute format(
      'create policy %I on public.%I for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      'Owner can update ' || table_name,
      table_name
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated using (owner_id = (select auth.uid()))',
      'Owner can delete ' || table_name,
      table_name
    );
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values
  ('research-media', 'research-media', false),
  ('research-documents', 'research-documents', false),
  ('board-assets', 'board-assets', false)
on conflict (id) do update set public = excluded.public;

create policy "Owner can read research media"
on storage.objects for select
to authenticated
using (bucket_id = 'research-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owner can insert research media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'research-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owner can update research media"
on storage.objects for update
to authenticated
using (bucket_id = 'research-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'research-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owner can delete research media"
on storage.objects for delete
to authenticated
using (bucket_id = 'research-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owner can read research documents"
on storage.objects for select
to authenticated
using (bucket_id = 'research-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owner can insert research documents"
on storage.objects for insert
to authenticated
with check (bucket_id = 'research-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owner can update research documents"
on storage.objects for update
to authenticated
using (bucket_id = 'research-documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'research-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owner can delete research documents"
on storage.objects for delete
to authenticated
using (bucket_id = 'research-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owner can read board assets"
on storage.objects for select
to authenticated
using (bucket_id = 'board-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owner can insert board assets"
on storage.objects for insert
to authenticated
with check (bucket_id = 'board-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owner can update board assets"
on storage.objects for update
to authenticated
using (bucket_id = 'board-assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'board-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owner can delete board assets"
on storage.objects for delete
to authenticated
using (bucket_id = 'board-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
