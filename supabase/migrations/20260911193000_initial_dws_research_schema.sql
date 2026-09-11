create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null default 'web',
  title text,
  url text,
  creator text,
  publication text,
  published_at date,
  doi text,
  zotero_item_key text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null,
  title text,
  bucket text not null default 'research-media',
  storage_path text,
  original_filename text,
  mime_type text,
  byte_size bigint,
  width integer,
  height integer,
  duration_seconds numeric,
  sha256 text,
  perceptual_hash text,
  source_id uuid references public.sources(id) on delete set null,
  source_page integer,
  source_url text,
  alt_text text,
  caption text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text,
  summary text,
  project_type text,
  status text not null default 'active',
  start_date date,
  end_date date,
  cover_media_id uuid references public.media(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create table public.research_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  summary text,
  question text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public."references" (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  reference_type text not null default 'precedent',
  creator text,
  project_name text,
  reference_date text,
  location text,
  description text,
  why_saved text,
  primary_media_id uuid references public.media(id) on delete set null,
  primary_source_id uuid references public.sources(id) on delete set null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  cover_media_id uuid references public.media(id) on delete set null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collection_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  sort_order integer,
  note text,
  created_at timestamptz not null default now(),
  unique (collection_id, record_type, record_id)
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  description text,
  properties jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.processes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  description text,
  parameters jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  research_thread_id uuid references public.research_threads(id) on delete set null,
  title text not null,
  objective text,
  method text,
  result_summary text,
  status text not null default 'draft',
  experiment_date date,
  data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  research_thread_id uuid references public.research_threads(id) on delete set null,
  title text not null,
  description text,
  board_type text not null default 'freeform',
  snapshot jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.board_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  shape_id text,
  record_type text,
  record_id uuid,
  item_type text not null default 'record',
  x double precision,
  y double precision,
  width double precision,
  height double precision,
  rotation double precision not null default 0,
  z_index integer,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text,
  parent_type text,
  parent_id uuid,
  content jsonb not null default '[]'::jsonb,
  plain_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lineage_graphs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  research_thread_id uuid references public.research_threads(id) on delete set null,
  title text not null,
  description text,
  viewport jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lineage_nodes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  graph_id uuid not null references public.lineage_graphs(id) on delete cascade,
  record_type text,
  record_id uuid,
  node_type text not null default 'record',
  label text,
  x double precision,
  y double precision,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lineage_edges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  graph_id uuid not null references public.lineage_graphs(id) on delete cascade,
  source_node_id uuid not null references public.lineage_nodes(id) on delete cascade,
  target_node_id uuid not null references public.lineage_nodes(id) on delete cascade,
  relationship_type text,
  label text,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.record_tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (record_type, record_id, tag_id)
);

create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  relationship_type text not null,
  target_type text not null,
  target_id uuid not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_type, source_id, relationship_type, target_type, target_id)
);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_sources_updated_at
before update on public.sources
for each row execute function public.set_updated_at();

create trigger set_media_updated_at
before update on public.media
for each row execute function public.set_updated_at();

create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger set_research_threads_updated_at
before update on public.research_threads
for each row execute function public.set_updated_at();

create trigger set_references_updated_at
before update on public."references"
for each row execute function public.set_updated_at();

create trigger set_collections_updated_at
before update on public.collections
for each row execute function public.set_updated_at();

create trigger set_materials_updated_at
before update on public.materials
for each row execute function public.set_updated_at();

create trigger set_processes_updated_at
before update on public.processes
for each row execute function public.set_updated_at();

create trigger set_experiments_updated_at
before update on public.experiments
for each row execute function public.set_updated_at();

create trigger set_boards_updated_at
before update on public.boards
for each row execute function public.set_updated_at();

create trigger set_board_items_updated_at
before update on public.board_items
for each row execute function public.set_updated_at();

create trigger set_notes_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

create trigger set_lineage_graphs_updated_at
before update on public.lineage_graphs
for each row execute function public.set_updated_at();

create trigger set_lineage_nodes_updated_at
before update on public.lineage_nodes
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_path)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    new.raw_user_meta_data ->> 'avatar_path'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public;

create index sources_owner_created_at_idx on public.sources(owner_id, created_at desc);
create index media_owner_created_at_idx on public.media(owner_id, created_at desc);
create index media_source_id_idx on public.media(source_id);
create index projects_owner_created_at_idx on public.projects(owner_id, created_at desc);
create index research_threads_owner_created_at_idx on public.research_threads(owner_id, created_at desc);
create index references_owner_created_at_idx on public."references"(owner_id, created_at desc);
create index references_primary_source_id_idx on public."references"(primary_source_id);
create index references_primary_media_id_idx on public."references"(primary_media_id);
create index collections_owner_created_at_idx on public.collections(owner_id, created_at desc);
create index collection_items_collection_id_idx on public.collection_items(collection_id);
create index collection_items_record_idx on public.collection_items(record_type, record_id);
create index experiments_project_id_idx on public.experiments(project_id);
create index experiments_research_thread_id_idx on public.experiments(research_thread_id);
create index boards_project_id_idx on public.boards(project_id);
create index boards_research_thread_id_idx on public.boards(research_thread_id);
create index board_items_board_id_idx on public.board_items(board_id);
create index notes_parent_idx on public.notes(parent_type, parent_id);
create index lineage_nodes_graph_id_idx on public.lineage_nodes(graph_id);
create index lineage_edges_graph_id_idx on public.lineage_edges(graph_id);
create index record_tags_record_idx on public.record_tags(record_type, record_id);
create index relationships_source_idx on public.relationships(source_type, source_id);
create index relationships_target_idx on public.relationships(target_type, target_id);

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
    'sources',
    'media',
    'projects',
    'research_threads',
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
