# Source coordination milestone — 20 September 2026

## Outcome
Find a saved source, open its stable detail page, edit it, and see the Topics, Projects, Collections, References, and Boards where it is directly used.

## Implemented
- Workspace title search across seven repositories, with repository filters, pagination, explicit empty/error states, and literal wildcard escaping. This is title search, not document full-text or semantic search.
- Stable `/library/items/media/:id` and `/library/items/note/:id` pages with ownership checks, edit/delete controls, original file access, and Used in links. Library cards and Board source actions use those pages.
- Used in covers incoming relationships, outgoing project associations, collection membership, note parents, cover use, saved Board placements, and unopened generated Board compositions. Duplicates are removed; each destination is resolved through owner-filtered queries. These are direct associations, not inferred/transitive ones.
- Consolidated Reference context panels into Used in.
- Board autosave now fetches only placed record IDs, grouped by type, instead of loading the full research catalog. Query errors block saving rather than silently dropping valid placements. Deleted source placeholders remain supported.
- `npm test` runs all regression tests. GitHub Actions runs lint, tests, and a production build on main pushes and pull requests. The workflow does not change deployment gating or branch-protection settings.

## Verification
- Automated tests cover owner isolation, linked-source lookup, deduplication, deleted sources, targeted Board queries, malformed inputs, rich-content preservation, Storage failures, and retry after database cleanup failure.
- Remote Supabase smoke test used the authenticated database role within one rollback transaction: note editing, generated Board lookup, reference deletion, link cleanup, and shared-container preservation passed. No persistent test records or real-content deletions.
- Desktop and 390px mobile visual checks exercised the production search view and Used in renderer with synthetic data. No horizontal page overflow. Temporary fixture removed before build.
- Browser authentication, real Storage file deletion, and Brave subscription access remain live-service checks; they are not claimed as completed by the rollback database test.

## Next acceptance scenario
Use one real research question to select PDF pages, pin evidence on a Board, write observations, and produce a sourced pin-up. PDF.js page research is the next feature layer; named views and export follow. Add authenticated browser automation with a dedicated disposable test account before claiming full end-to-end verification.
