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

## Research Topics

Research Topics use `research_threads`, separate from design Projects. Routes:
`/research`, `/research/[id]`, and `/research/[id]/edit`. The index shows current
topics and offers an archived view. Title, central question, scope, and status
are editable; no migration or new environment variables are required.

Research Area (broad family) and Research Type (kind of inquiry) are stored in
`research_threads.metadata.research_area` and `research_type`. Topic edits merge
these keys while preserving other metadata. The nine Type choices are Fabrication,
Materials, Computation / AI, Historical / Theoretical, Structural / Geometric,
Product / Tool Development, Teaching / Pedagogy, Literature Review, and Other.
The Research index groups by Area with lightweight Status/Area/Type filters.
Unassigned topics remain visible under Unassigned area. Cards show Type, Status,
the primary question, and counts. Topic headers show Area / Type / Status above
the title and question; the full question remains available in Overview.

Literature now has an in-place Upload PDF panel alongside existing record links.
Files go directly from the authenticated browser to the private research-documents
bucket at `<owner-id>/research/<topic-id>/<upload-uuid>-<sanitized-filename>`.
No Project is required. Multiple files are staged with editable titles, sizes,
per-file states, indeterminate upload/saving progress, and individual errors.
The panel refreshes server data only after the batch, without a full-page reload.

Server actions validate topic ownership and uploaded PDF MIME type, size, and
header before creating media and has_document links. The upload UUID is also the
media ID, so finalization retries reuse the same document. Empty titles derive
from filenames. Files are limited to 20 MB each by the application. Phase status
is shown rather than a fabricated byte percentage. Retry state survives the
in-place refresh but not closing/reloading the browser tab. Abandoned uploads
can leave private unlinked objects; no automatic deletion policy is introduced.

Documents display title, filename, size, upload date, document type, and the
topic-specific relevance note. Open PDF uses the existing expiring signed URL in
a new tab, leaving the Topic open. Title/document type edits belong to the media
record; review status and all literature-review fields remain on the topic link.
Unlinking retains both media and its Storage object.

Read-only inspection on 2026-09-15 confirmed research-documents is private and
its Storage policies enforce the owner folder. No production schema changes were
made. Tests cover organization metadata retention, PDF validation, multi-document
finalization/retries, metadata editing, and unlink preservation using a mock
client. Live authenticated upload/open/reload testing still requires local
Supabase credentials. No new packages or environment variables were introduced.

The workspace has Overview, Discover, Literature, Precedents, Notes, Themes,
Collections, Boards, and Linked Projects views. Existing records are linked,
never copied. Literature uses scholarly/documentary reference types and PDFs;
remaining references appear in Precedents. Mark an item `key_source` in its
review to feature it on Overview. Library primary images provide visual previews.

Relationships originate at `source_type='research_thread'` and the topic ID:

- `has_reference` targets `reference`.
- `has_document` targets PDF `media`.
- `has_discover_session` targets `research_session`.
- `informs_project` targets `project`, also surfaced on Project detail.
- `has_collection` / `has_board` target their existing records.
- `has_theme` targets a reusable `tag`; its `note` stores the topic-specific
  theme description. The tag's name supplies the theme title.

Literature review fields live in the topic-to-reference/document relationship's
metadata: `review_status`, `relevance_note`, `key_argument`, `methodology`,
`findings`, `limitations`, `research_gap`, and `reviewed_at`. Global reference
fields are untouched, so interpretations remain independent across topics.

Theme members originate at `source_type='research_topic_theme'` with the
topic-to-tag relationship ID, using `includes` to target references, PDFs,
Projects, or topic notes. This keeps theme membership separate even when two
topics use the same tag name. Unlinking topic records also removes their theme
memberships within that topic. Unlinking never deletes the source record or tag.

Notes use `parent_type='research_thread'` and `parent_id=topic.id`. Plain text is
the current editing surface; existing content JSONB is retained for a future rich
editor. Note deletion is explicit and also removes theme links to that note.

Discover's Add to Research Topic accepts an existing topic or creates a new one.
With no selection it links the session; with selected results it invokes the
existing deduplicating import RPC and then links the imported references plus
the session. Import and topic linking are separate writes: a linking failure
leaves imported library records intact and reports a retryable error. The UI
retains a newly created topic ID for retry. Unique relationships prevent repeated
membership links. Original session provenance and saved-reference mapping remain.

Security: all new reads/writes use the signed-in Supabase client and explicit
owner filters. Link actions validate both topic and target ownership; theme
membership also requires topic membership. Read-only live policy inspection on
2026-09-14 confirmed owner-scoped RLS on research_threads, relationships, notes,
tags, and research_sessions, including UPDATE ownership checks. No live database
data or schema was changed by development validation.

`node --test --test-isolation=none tests/research.cjs tests/discover.cjs` tests the
server actions against an in-memory client, including ownership rejection,
deduplication, review isolation, rich note retention, theme cleanup, and Discover
retry behavior. This is not a substitute for authenticated live persistence tests.
Local fixture rendering verifies workspace and review controls; the temporary
fixture route is not shipped. Local Supabase credentials are still needed for
end-to-end authenticated create/link/reload testing.

Current limits: selectors load owner records in batches rather than searchable
server-side pagination; recent activity lists membership creation rather than a
complete audit trail; themes share tag titles but have topic-specific descriptions;
board association opens the existing Boards area. Multi-step writes are not one
transaction. No AI synthesis, clustering, rich editor, or Board generation is added.
Next: validate real topic workflows, then add literature comparison/export and
searchable record pickers before opt-in, versioned AI synthesis.

## Deferred Packages

Boards now uses tldraw. BlockNote, React Flow, PDF.js, Uppy and AI generation remain deferred.
# Generated Research Boards

Topic Boards (`/research/[id]/boards`) offers manual and generated compositions. Choose up to 100 topic records, a layout, and a title; each generation creates a new board. `/boards` lists boards and `/boards/[id]` opens the full-screen editor. Topic links, notes, themes, reference/project attachments and linked collections are available without copying source records.

## Board deployment

- Apply `supabase/migrations/20260916181217_board_snapshot_persistence.sql` through the normal reviewed deployment process before enabling board editing. This repository change does **not** apply it to production.
- Set `NEXT_PUBLIC_TLDRAW_LICENSE_KEY` to a valid production license. tldraw 5.4.2 permits local development without a key; production requires a license: https://tldraw.dev/community/license. No license is purchased or provisioned by this repository.
- Existing public Supabase URL/publishable key and authenticated owner RLS remain required. No service-role key is used.

## Board architecture

- `ResearchBoardCanvas` isolates tldraw; it is dynamically imported without SSR. Native tools handle movement, resizing, rotation, duplication, frames, drawing, arrows, text and sticky notes. The ordinary sidebar is omitted in the editor.
- `lib/boards/layout.ts` is a pure deterministic composition engine usable by topic, collection or future Discover services. Research Wall separates evidence, visual material and thinking; Contact Sheet is a five-column grid; Theme Clusters uses topic-specific theme frames (shared records can have multiple placements); Literature + Precedent uses narrower evidence/visual columns. No AI calls.
- The authenticated `createGeneratedBoard` action validates topic ownership and selection. Board metadata records source topic, selected keys, generation version, timestamp, layout and initial composition. Supabase research records remain authoritative; snapshot cards contain only identity and geometry, not copied text or image URLs. Titles and previews refresh when the board is reopened.
- `boards.snapshot` stores the tldraw document, not camera/selection state. `board_items` mirrors linked placements with parent/index state. PDFs use `item_type=document`, themes use `theme`, other linked records use `record`. The item vocabulary also reserves `tool` and typed tool configuration; no specialist tools are implemented.
- Saves debounce for 900 ms and serialize writes. The security-invoker `save_research_board` RPC locks the owned board, checks its exact revision, validates linked owners, then updates snapshot and placements in one transaction. A stale session cannot overwrite a newer save. Errors retain the pending snapshot in memory with Retry; reload is required for revision conflicts. Leave warnings protect unsaved work, but there is no durable offline recovery or collaboration yet.
- Source cards support the header's Open Source command. PDFs/images go through an authenticated fresh signed-URL redirect to the browser viewer. Notes and themes open their parent context. Removing a placement never deletes its source.
- Add provides a searchable owner-scoped record picker and freeform tools. Text/sticky conversion opens an editable form, creates a topic Note or Reference with a stable retry ID, then replaces the loose placement. References are linked to the topic. No automatic conversion.
- Image drops upload JPEG/PNG/WebP (up to 20 MB) directly to the private `research-media` owner folder, validate content server-side, register media and place a linked card. Retry retains the upload ID. Native embedded-asset imports are blocked. Thumbnails are authenticated, resized with sharp to fit 640px, private-cacheable and lazily loaded; originals are not sent to the canvas.

## Board validation and limits

Run `npm install`, `npm run lint`, `npm run typecheck`, `npm run build`, and `node --test --test-isolation=none tests/boards.cjs tests/board-persistence.cjs tests/research.cjs tests/discover.cjs`.

Tests cover deterministic/nonoverlapping layouts at 100 records, shared themes, owner-scoped server saves, embedded-asset rejection and stale revisions. PGlite runs the repository baseline and save migration against an isolated Postgres engine, including atomic rollback, PDF placement type, owner RLS and denied anonymous RPC access. It does not contact Supabase. Browser fixture checks cover drag, resize, duplicate/delete, text/sticky/sketch/arrow, conversion form, local document reload and mobile fit; the temporary fixture is not shipped.

Live authenticated uploads, conversions and Supabase save/reload still need a staging smoke test after migration and environment setup. Generation is capped at 100 selected records/300 theme placements; saves at 500 linked placements and 8 MB. Deleted sources display unavailable and must be removed before saving. The picker currently loads the owner's full catalog; server-side paginated search is a next scaling step. No board thumbnails, realtime collaboration, PDF page rendering, offline recovery, specialist nodes or AI generation yet. Next milestone: staging validation and durable draft recovery, then Collection/Discover-to-Board handoff.
