import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { thumbnailUrl } from "@/lib/thumbnails";
import { externalImageReference } from "@/lib/discover/images";
import { compareEntries, intersectIds, libraryHref, libraryLabels, libraryPattern, mediaEntry, mergeEntries, noteEntry, pageSizeFor, parseLibraryLayout, parseLibrarySort, parseLibraryView, parseTagIds, parseWithin, referenceEntry, type LibraryEntry, type LibraryKind, type LibraryState } from "@/lib/library";
import { LibraryFilters } from "@/components/library-filters";
import { LibraryToolbar } from "@/components/library-toolbar";
import { LibraryGrid } from "@/components/library-grid";

const emptyHints: Record<string, string> = {
  all: "Use Capture to add images, notes, and links. Files added in research topics, projects, and boards appear here too.",
  images: "Use Capture to add images. Images uploaded within projects and boards appear here too.",
  documents: "Upload a PDF in a research topic or project to add it here.",
  notes: "Notes from research topics and boards appear here, ready to edit and reuse.",
  references: "Save a precedent, book, or website as a reference, or keep one from Discover.",
};

type Row = Record<string, unknown>;
type Result = { data: Row[] | null; count: number | null; error: unknown };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; page?: string; layout?: string; sort?: string; tags?: string; in?: string; uploaded?: string; error?: string }> }) {
  const user = await requireUser(); const db = await createClient(); const query = await searchParams;
  const view = parseLibraryView(query.view); const layout = parseLibraryLayout(query.layout); const sort = parseLibrarySort(query.sort); const size = pageSizeFor(layout);
  const page = Math.max(1, Math.min(10000, Math.floor(Number(query.page) || 1))); const start = (page - 1) * size;
  const search = (query.q || "").trim().slice(0, 120); const pattern = libraryPattern(search);
  const mediaView = view === "images" || view === "documents";
  const tagIds = mediaView ? parseTagIds(query.tags) : []; const within = mediaView ? parseWithin(query.in) : null;
  const state: LibraryState = { view, q: search, layout, sort, tags: tagIds, within: within ? `${within.kind}:${within.id}` : undefined, page };

  // Reads every matching row in pages of 1000, for link tables that can outgrow one response.
  async function every(build: (from: number) => PromiseLike<{ data: Row[] | null; error: unknown }>) {
    const rows: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await build(from);
      if (error) throw new Error("Could not load library filters. Please retry.");
      rows.push(...(data || []));
      if (!data || data.length < 1000) return rows;
    }
  }
  const tagged = (tagId: string) => every(from => db.from("record_tags").select("record_id").eq("owner_id", user.id).eq("record_type", "media").eq("tag_id", tagId).range(from, from + 999)).then(rows => rows.map(row => String(row.record_id)));
  async function usedIn(place: NonNullable<typeof within>) {
    if (place.kind !== "board") return (await every(from => db.from("relationships").select("target_id").eq("owner_id", user.id).eq("source_type", place.kind).eq("source_id", place.id).eq("target_type", "media").range(from, from + 999))).map(row => String(row.target_id));
    const [items, board] = await Promise.all([
      every(from => db.from("board_items").select("record_id").eq("owner_id", user.id).eq("board_id", place.id).eq("record_type", "media").range(from, from + 999)),
      db.from("boards").select("metadata").eq("owner_id", user.id).eq("id", place.id).maybeSingle(),
    ]);
    // Generated boards list their cards in metadata rather than board_items.
    const placements = (board.data?.metadata as { composition?: { placements?: { key?: string }[] } } | null)?.composition?.placements || [];
    return [...items.map(row => String(row.record_id)), ...placements.map(item => item.key || "").filter(key => key.startsWith("media:")).map(key => key.slice(6))];
  }
  const filterIds = intersectIds(await Promise.all([...tagIds.map(tagged), ...(within ? [usedIn(within)] : [])]));

  // Each table is read in the same order the merged page uses, so "Everything" pages line up.
  const ordered = <Q extends { order: (column: string, options: { ascending: boolean; nullsFirst?: boolean }) => Q }>(request: Q, fallback?: string) => {
    if (sort !== "title") return request.order("updated_at", { ascending: sort === "oldest" });
    const byTitle = request.order("title", { ascending: true, nullsFirst: false });
    return fallback ? byTitle.order(fallback, { ascending: true }) : byTitle;
  };
  const shown = (kind: LibraryKind) => view === "all" || view === kind;
  const rangeFor = (kind: LibraryKind): [number, number] => view === "all" ? [0, start + size - 1] : view === kind ? [start, start + size - 1] : [0, 0];
  const mediaSearch = `title.ilike.${pattern},caption.ilike.${pattern},original_filename.ilike.${pattern}`;
  async function mediaQuery(kind: "images" | "documents"): Promise<Result> {
    const type = kind === "images" ? "image" : "document";
    if (view === kind && filterIds) {
      // With tag or place filters, match ids in chunks, then load full rows only for this page.
      const matches: Row[] = [];
      for (let i = 0; i < filterIds.length; i += 150) {
        let request = db.from("media").select("id,title,original_filename,updated_at").eq("owner_id", user.id).eq("media_type", type).in("id", filterIds.slice(i, i + 150));
        if (pattern) request = request.or(mediaSearch);
        const { data, error } = await request;
        if (error) return { data: null, count: 0, error };
        matches.push(...data);
      }
      const ids = matches.map(mediaEntry).sort(compareEntries(sort)).slice(start, start + size).map(entry => entry.id);
      const { data, error } = ids.length ? await db.from("media").select("*").eq("owner_id", user.id).in("id", ids) : { data: [], error: null };
      const order = new Map(ids.map((id, index) => [id, index]));
      return { data: (data || []).sort((a, b) => order.get(a.id)! - order.get(b.id)!), count: matches.length, error };
    }
    let request = db.from("media").select("*", { count: "exact", head: !shown(kind) }).eq("owner_id", user.id).eq("media_type", type);
    if (pattern) request = request.or(mediaSearch);
    return ordered(request, "original_filename").range(...rangeFor(kind));
  }
  let notesRequest = db.from("notes").select("id,title,plain_text,parent_type,updated_at", { count: "exact", head: !shown("notes") }).eq("owner_id", user.id).or("parent_type.is.null,parent_type.not.in.(dossier_settings,opportunity_settings,opportunity_lead)");
  if (pattern) notesRequest = notesRequest.or(`title.ilike.${pattern},plain_text.ilike.${pattern}`);
  let referencesRequest = db.from("references").select("id,title,reference_type,creator,why_saved,description,primary_media_id,metadata,updated_at", { count: "exact", head: !shown("references") }).eq("owner_id", user.id);
  if (pattern) referencesRequest = referencesRequest.or(`title.ilike.${pattern},why_saved.ilike.${pattern},creator.ilike.${pattern},description.ilike.${pattern}`);

  const [images, documents, notes, references] = await Promise.all([
    mediaQuery("images"), mediaQuery("documents"),
    ordered(notesRequest).range(...rangeFor("notes")),
    ordered(referencesRequest).range(...rangeFor("references")),
  ]);
  const error = images.error || documents.error || notes.error || references.error;
  const counts = { images: images.count || 0, documents: documents.count || 0, notes: notes.count || 0, references: references.count || 0 };
  const total = view === "all" ? counts.images + counts.documents + counts.notes + counts.references : counts[view];

  const entries = mergeEntries([
    shown("images") ? (images.data || []).map(mediaEntry) : [],
    shown("documents") ? (documents.data || []).map(mediaEntry) : [],
    shown("notes") ? (notes.data || []).map(noteEntry) : [],
    shown("references") ? (references.data || []).map(row => referenceEntry(row, externalImageReference(row.metadata as Record<string, unknown>)?.thumbnail)) : [],
  ], view === "all" ? start : 0, size, sort);

  // Images and reference covers load through cached thumbnails rather than full-size signed originals.
  const mediaIds = entries.filter(entry => entry.kind === "images" || entry.kind === "documents").map(entry => entry.id);
  const [entryTags, allTags, places] = await Promise.all([
    mediaIds.length ? db.from("record_tags").select("record_id,tag_id").eq("owner_id", user.id).eq("record_type", "media").in("record_id", mediaIds).then(result => result.data || []) : Promise.resolve([] as Row[]),
    mediaView ? every(from => db.from("record_tags").select("tag_id").eq("owner_id", user.id).eq("record_type", "media").range(from, from + 999)) : Promise.resolve([] as Row[]),
    mediaView ? Promise.all((["projects", "research_threads", "boards"] as const).map(table => db.from(table).select("id,title").eq("owner_id", user.id).order("title").limit(300).then(result => result.data || []))) : Promise.resolve([[], [], []]),
  ]);

  // Tag names for both the chips (counted across the archive) and the tags shown on each card.
  const tagCounts = new Map<string, number>(); allTags.forEach(row => tagCounts.set(String(row.tag_id), (tagCounts.get(String(row.tag_id)) || 0) + 1));
  const nameIds = [...new Set([...tagCounts.keys(), ...entryTags.map(row => String(row.tag_id))])];
  const { data: tagRows } = nameIds.length ? await db.from("tags").select("id,name").eq("owner_id", user.id).in("id", nameIds) : { data: [] };
  const tagName = new Map((tagRows || []).map(row => [row.id as string, row.name as string]));
  const chips = [...tagCounts].filter(([id]) => tagName.has(id)).map(([id, count]) => ({ id, name: tagName.get(id)!, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const tagsByRecord = new Map<string, { id: string; name: string }[]>();
  entryTags.forEach(row => { const name = tagName.get(String(row.tag_id)); if (name) tagsByRecord.set(String(row.record_id), [...(tagsByRecord.get(String(row.record_id)) || []), { id: String(row.tag_id), name }]); });

  const imageFor = (entry: LibraryEntry) => entry.thumbnail || (entry.kind === "documents" || !entry.mediaId ? null : thumbnailUrl(entry.mediaId));
  const gridEntries = entries.map(entry => ({ ...entry, image: imageFor(entry), tags: tagsByRecord.get(entry.id) || [] }));
  const [projects, topics, boards] = places;
  const option = (kind: string) => (row: Row) => ({ value: `${kind}:${row.id}`, label: String(row.title || "Untitled") });
  const filtered = !!filterIds;

  return <>
    <header className="page-header"><div><p className="eyebrow">Your source archive</p><h1 className="page-title">Library</h1><p className="page-description">Every image, document, note, and reference in one place. Filter by type or search across all of them.</p></div><Link className="button" href="/library/references">New reference</Link></header>
    <form className="repository-search library-search" role="search">{view !== "all" && <input type="hidden" name="view" value={view} />}{layout !== "grid" && <input type="hidden" name="layout" value={layout} />}{sort !== "newest" && <input type="hidden" name="sort" value={sort} />}{tagIds.length > 0 && <input type="hidden" name="tags" value={tagIds.join(",")} />}{state.within && <input type="hidden" name="in" value={state.within} />}<label className="field"><span>Search {view === "all" ? "the library" : libraryLabels[view].toLowerCase()}</span><input name="q" type="search" defaultValue={search} placeholder="Titles, captions, notes, creators…" /></label><button className="button">Search</button>{search && <Link className="button" href={libraryHref({ ...state, q: "", page: 1 })}>Clear</Link>}</form>
    <LibraryFilters active={view} search={search} layout={layout} sort={sort} counts={{ all: counts.images + counts.documents + counts.notes + counts.references, ...counts, ...(filtered ? { all: undefined, [view]: undefined } : {}) }} />
    <LibraryToolbar state={state} tags={mediaView ? chips : undefined} places={mediaView ? [{ label: "Projects", options: projects.map(option("project")) }, { label: "Research topics", options: topics.map(option("research_thread")) }, { label: "Boards", options: boards.map(option("board")) }] : undefined} />
    {query.uploaded && <p className="notice notice-success">Images saved to your library.</p>}
    {(error || query.error) && <p role="alert" className="notice notice-error">{query.error || "Unable to load the library. Please retry."}</p>}
    {!error && !entries.length && <div className="empty-state"><h2>{search || filtered ? "Nothing matches these filters" : view === "all" ? "Your library is empty" : `No ${libraryLabels[view].toLowerCase()} yet`}</h2><p>{search || filtered ? "Try another word, fewer tags, or a different place." : emptyHints[view]}</p></div>}
    <LibraryGrid entries={gridEntries} layout={layout} grouped={sort !== "title"} selectable={mediaView} editable={view === "images" || view === "documents" || view === "notes"} tags={chips.map(tag => ({ id: tag.id, title: tag.name }))} projects={projects.map(row => ({ id: String(row.id), title: String(row.title || "Untitled") }))} />
    <nav className="section-actions" aria-label="Library pages"><span className="record-meta">{total} {total === 1 ? "item" : "items"}</span>{page > 1 && <Link className="button" href={libraryHref({ ...state, page: page - 1 })}>Previous</Link>}{start + entries.length < total && <Link className="button" href={libraryHref({ ...state, page: page + 1 })}>Next</Link>}</nav>
  </>;
}
