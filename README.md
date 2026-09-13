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
All, Projects, Papers, Labs, and Videos modes append a short OR-group to the
original question and influence deterministic ranking. Topic adds a discipline
term. Optional year bounds use Brave's custom freshness range and take precedence
over relative freshness; this is provider page freshness, not verified publication
year. At most 20 results are returned per search. No specialized image search is used.

`rankDiscoverResults(results, query, mode)` separates classification/ranking from
the provider and leaves a boundary for an optional future reranker. Classification
checks video URLs, commercial paths/sales language, scholarly domains/publication
language, project paths/case-study language, lab identity, vendors, and direct image
URLs, in that order. General pages fall back to article or other. Legacy studio
filters map to Labs and old sessions remain readable.

Scores sum title/snippet query overlap (up to 45), architectural terms (12),
fabrication terms (15), materials (10), project evidence (12), and modest source
preferences (8). Mode adds 120 points for the preferred class, decreasing by 30
per class tier. Projects favors project/lab/paper/article; Papers favors
paper/lab/article/project; Labs favors lab/project/paper; Videos favors video.
Each commercial, generic guide, consumer-printing, or weak-query signal subtracts
12. Scores are ranking weights, not percentages or confidence estimates. Ties
retain provider order. Metadata records the breakdown, evidence, source type,
penalties, and ranking version. Source indicators and classifications are
heuristic, not verified authority or AI analysis.

Mode changes reorder the current review set locally without a provider call or
clearing selection. Search again stores a new snapshot using that mode. Reopening
an existing session preserves its stored order and import mapping. Cards use a
290px neutral image area with `object-fit: contain`, original-image preference,
thumbnail fallback, two-line snippets, short relevance signals, and native
expandable detail/metadata sections.

`createDiscoverSnapshot` explicitly allowlists normalized fields and scoring
metadata at the storage boundary; raw provider payloads are excluded. This is the
place to reduce retained data if provider terms change. No session schema or
import RPC changes are required for this milestone.

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
keys, provider failures, classification, mode ranking, and snapshot filtering with
fixture responses. Fixtures for the five milestone queries show projects ahead of
printer guides, papers first in Papers, and labs first in Labs. These are not live
Brave quality measurements. Live search requires a Brave
key; authenticated persistence/import checks require the migration and a signed-in
test account. Run install, lint, typecheck, and build as above.

Next: add an internal provider with owner-filtered text search before embeddings;
introduce opt-in enrichment jobs storing versioned output in metadata; pass the
session's saved reference IDs to a future board creation action. AI enrichment,
semantic search, remote image import, pagination, and board generation are deferred.

## Deferred Packages

This milestone intentionally does not include tldraw, BlockNote, React Flow, PDF.js, Uppy, or AI packages.
