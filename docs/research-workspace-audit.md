# Research workspace audit — 19 September 2026

## Product direction
DWS connects inquiry, visual research, design work, and practice. Research Topics hold questions; Projects hold design work; Collections curate reusable sources; Boards support spatial synthesis. Preserve provenance and optional structure. PDF page research → Board placement follows this usability pass.

## Delivered
- Confirmed permanent deletion for projects, references, topics, collections, boards, uploaded media, notes, and Discover sessions. Existing edit forms remain; Library adds title/caption/alternative-text and note editing; session titles can be renamed.
- Owner-scoped, security-invoker deletion RPC removes polymorphic links transactionally. Shared files/references/notes/boards survive container deletion. Notes detach into Library. Media deletion clears cover foreign keys and removes its stored original.
- Deletion invalidates affected board revisions. Saved canvas positions remain as unavailable-source cards; later saves omit dangling placements. Unopened generated compositions drop deleted-source placements.
- Library replaces placeholders with paginated, searchable Images, Documents, and Notes repositories alongside References.
- Today replaces placeholders with recent topics/projects, a small board wall, and direct entry points.
- Capture uses named project/reference destinations and defaults to Library. Server verifies destination ownership. Unassigned captures now land in a visible archive.
- Project references can be removed without deleting the source. Link actions preserve the active project mode. Hidden unimplemented Notes navigation and clarified References tab.
- Removed inert Ask button; Atlas describes the intended materials/processes/products/tools knowledge system and is marked planned.
- Calmer warm-neutral/olive palette, narrower sidebar, editorial headings, natural image proportions, accessible focus states and mobile navigation. Creation/maintenance forms stay secondary to browsing.

## Verification and limits
- Production build, lint, typecheck; full regression suite plus Postgres deletion tests.
- Browser review of real shell, archive styles, edit disclosures and delete controls with synthetic fixture data at desktop and 390px mobile widths. No page overflow. Verified type-to-confirm and Escape cancellation. Fixture removed before production build.
- No live user content was deleted. Storage deletion and authenticated editing need a real-session smoke test; storage and SQL are separate transactions. If storage fails the record remains; if SQL cleanup fails after file removal the UI asks to retry.
- Deletion is permanent, with an explicit DELETE confirmation; this is not a Trash/restore system.
- Atlas remains planned. PDF page extraction, page notes, named views, and export remain the next research-workspace layer.
- Existing Supabase auth advisory findings remain unchanged: handle_new_user function execution grants and disabled leaked-password protection (see README remediation links).
