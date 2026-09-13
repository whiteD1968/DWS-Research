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
- Initial Vercel production deployment is configured.

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

## Discover Research Search

`/discover` accepts a natural-language research question and optional freshness,
content, and discipline filters. `/discover/sessions/[id]` reopens the stored
result snapshot without another search request. Search again explicitly creates
a new session. Successful searches automatically save history; importing any
result into the library always requires selection and an explicit save action.

Setup:

- Apply `supabase/migrations/20260913172223_discover_research_sessions.sql` through
  the normal reviewed migration process. The implementation does not apply it to production.
- Set server-only `BRAVE_SEARCH_API_KEY` locally and in Vercel. Use a Brave plan
  that permits storing search results. Existing public Supabase URL and
  publishable-key variables remain required. No service-role key is used.
- Missing keys and provider errors appear inside Discover. There are no demo
  results and no automatic fallback to fabricated results.

The `lib/discover` service defines a provider-independent `DiscoverResult`:
id, provider, origin, resultType, title, URL, optional subtitle, summary,
sourceName, publishedAt, creator, location, imageUrl, thumbnailUrl,
relevanceReason, and extensible metadata. The Brave adapter uses the documented
[Web Search API](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started).
Content/discipline filters refine query terms, rather than guaranteeing a typed
vertical search. Web pages are conservatively classified as articles; creator
and publication details are left absent unless supplied. Relevance reflects
provider ranking, not AI analysis. At most 20 results are returned per search.

Sessions store the original query, filters, normalized results, timestamps,
status, and a result-ID-to-reference-ID map. They have owner-scoped RLS and an
updated-at trigger. The security-invoker import RPC locks by owner and imports
the entire selection in one transaction, including optional collection creation
and membership. Retry saves reuse existing references and collection membership.

Sources are matched using canonical URLs (tracking parameters/fragments removed,
query parameters sorted). References match their source URL or exact titles
normalized for case, punctuation, and whitespace. Existing matches are linked in
the grid and can be added to a collection. Source checks scan the owner's sources;
library match display scans references in batches. Indexed canonical URL fields
would be appropriate as the library grows. No fuzzy or embedding matching yet.

Imported references preserve source linkage and provenance metadata: normalized
URL, original result, type, import time, and session ID. External thumbnails are
preview-only; their URLs stay in metadata and never become primary media.
No remote images are fetched by the server or copied into Storage.

Validation: `node --test --test-isolation=none tests/discover.cjs` exercises URL
normalization, filter validation, partial provider records, duplicates, missing
keys, and provider failures with fixture responses. Live search requires a Brave
key; authenticated persistence/import checks require the migration and a signed-in
test account. Run install, lint, typecheck, and build as above.

Next: add an internal provider with owner-filtered text search before embeddings;
introduce opt-in enrichment jobs storing versioned output in metadata; pass the
session's saved reference IDs to a future board creation action. AI enrichment,
semantic search, remote image import, pagination, and board generation are deferred.

## Deferred Packages

This milestone intentionally does not include tldraw, BlockNote, React Flow, PDF.js, Uppy, or AI packages.
