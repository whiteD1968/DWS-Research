# DWS Research

DWS Research is a private Next.js workspace for architectural research practice: project knowledge, references, collections, source material, place-based inquiry, boards, and research lineage.

The application is intentionally restrained: white and light neutral surfaces, dark typography, subtle borders, generous spacing, and no decorative dashboard or sci-fi styling.

## Current Architecture

- Next.js App Router with TypeScript.
- Shared authenticated workspace shell under `app/(workspace)`.
- Supabase Auth with email/password sign in at `/login`.
- Protected workspace routes that redirect unauthenticated users to `/login`.
- Supabase browser and server clients in `lib/supabase`.
- Supabase session refresh proxy in `proxy.ts` and `lib/supabase/proxy.ts`.
- Initial Supabase schema migration in `supabase/migrations`.

Primary routes:

- `/` Today
- `/projects`
- `/research`
- `/atlas`
- `/collections`
- `/boards`
- `/library`
- `/library/references`
- `/library/references/[id]`
- `/login`

## First Workflow

The first functional data workflow is:

Reference -> Collection -> Project

A reference is stored once in `references`. It can appear in the Library, one or more Collections through `collection_items`, and one or more Projects through `relationships`.

Collection links use:

```text
record_type = reference
record_id = reference.id
```

Project links use:

```text
source_type = reference
source_id = reference.id
relationship_type = related_to
target_type = project
target_id = project.id
```

This keeps database records as the source of truth and avoids duplicating research content inside UI-specific state.

## Supabase

The live Supabase project is:

```text
https://bpobtbiuyfmqziidvgnm.supabase.co
```

Set the following variables in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Do not commit `.env.local` or any secrets.

The repository includes a migration representing the initial DWS Research schema, owner-scoped RLS policies, and private Storage buckets:

- `research-media`
- `research-documents`
- `board-assets`

Storage object paths should begin with the authenticated user's UUID so Storage RLS can isolate files by owner.

## Schema Foundation

The initial schema includes:

- `profiles`
- `projects`
- `research_threads`
- `sources`
- `media`
- `references`
- `collections`
- `collection_items`
- `materials`
- `processes`
- `experiments`
- `boards`
- `board_items`
- `notes`
- `lineage_graphs`
- `lineage_nodes`
- `lineage_edges`
- `tags`
- `record_tags`
- `relationships`

Most records are private by default through `owner_id = auth.uid()` RLS policies. Profiles are scoped by `profiles.id = auth.uid()`.

## Development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## Deferred Packages

This milestone intentionally does not include tldraw, BlockNote, React Flow, PDF.js, Uppy, or AI packages.
