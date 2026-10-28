/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSignedMediaUrlMap, type MediaRecord } from "@/lib/media";
import { externalImageReference } from "@/lib/discover/images";
import { libraryLabels, libraryPageSize, libraryPattern, mediaEntry, mergeEntries, noteEntry, parseLibraryView, referenceEntry, type LibraryEntry, type LibraryKind } from "@/lib/library";
import { LibraryFilters } from "@/components/library-filters";
import { DeleteContent, LibraryEditor } from "@/components/content-controls";

const emptyHints: Record<string, string> = {
  all: "Use Capture to add images, notes, and links. Files added in research topics, projects, and boards appear here too.",
  images: "Use Capture to add images. Images uploaded within projects and boards appear here too.",
  documents: "Upload a PDF in a research topic or project to add it here.",
  notes: "Notes from research topics and boards appear here, ready to edit and reuse.",
  references: "Save a precedent, book, or website as a reference, or keep one from Discover.",
};

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; page?: string; uploaded?: string; error?: string }> }) {
  const user = await requireUser(); const db = await createClient(); const query = await searchParams;
  const view = parseLibraryView(query.view);
  const page = Math.max(1, Math.min(10000, Math.floor(Number(query.page) || 1))); const start = (page - 1) * libraryPageSize;
  const search = (query.q || "").trim().slice(0, 120); const pattern = libraryPattern(search);

  // In "Everything", each kind returns its newest rows up to the end of this page, then they are merged by date.
  const shown = (kind: LibraryKind) => view === "all" || view === kind;
  const rangeFor = (kind: LibraryKind): [number, number] => view === "all" ? [0, start + libraryPageSize - 1] : view === kind ? [start, start + libraryPageSize - 1] : [0, 0];
  const mediaQuery = (kind: "images" | "documents") => {
    let request = db.from("media").select("*", { count: "exact", head: !shown(kind) }).eq("owner_id", user.id).eq("media_type", kind === "images" ? "image" : "document");
    if (pattern) request = request.or(`title.ilike.${pattern},caption.ilike.${pattern},original_filename.ilike.${pattern}`);
    return request.order("updated_at", { ascending: false }).range(...rangeFor(kind));
  };
  let notesRequest = db.from("notes").select("id,title,plain_text,updated_at", { count: "exact", head: !shown("notes") }).eq("owner_id", user.id);
  if (pattern) notesRequest = notesRequest.or(`title.ilike.${pattern},plain_text.ilike.${pattern}`);
  let referencesRequest = db.from("references").select("id,title,reference_type,creator,why_saved,description,primary_media_id,metadata,updated_at", { count: "exact", head: !shown("references") }).eq("owner_id", user.id);
  if (pattern) referencesRequest = referencesRequest.or(`title.ilike.${pattern},why_saved.ilike.${pattern},creator.ilike.${pattern},description.ilike.${pattern}`);

  const [images, documents, notes, references] = await Promise.all([
    mediaQuery("images"), mediaQuery("documents"),
    notesRequest.order("updated_at", { ascending: false }).range(...rangeFor("notes")),
    referencesRequest.order("updated_at", { ascending: false }).range(...rangeFor("references")),
  ]);
  const error = images.error || documents.error || notes.error || references.error;
  const counts = { images: images.count || 0, documents: documents.count || 0, notes: notes.count || 0, references: references.count || 0 };
  const total = view === "all" ? counts.images + counts.documents + counts.notes + counts.references : counts[view];

  const groups: LibraryEntry[][] = [
    shown("images") ? (images.data || []).map(mediaEntry) : [],
    shown("documents") ? (documents.data || []).map(mediaEntry) : [],
    shown("notes") ? (notes.data || []).map(noteEntry) : [],
    shown("references") ? (references.data || []).map(row => referenceEntry(row, externalImageReference(row.metadata)?.thumbnail)) : [],
  ];
  const entries = mergeEntries(groups, view === "all" ? start : 0, libraryPageSize);

  // Reference cover images live in media, so they are signed alongside the images on this page.
  const coverIds = entries.filter(entry => entry.kind === "references" && entry.mediaId && !entry.thumbnail).map(entry => entry.mediaId!);
  const { data: covers } = coverIds.length ? await db.from("media").select("id,bucket,storage_path").in("id", coverIds) : { data: [] };
  const signed = await getSignedMediaUrlMap([...(images.data || []).filter(row => entries.some(entry => entry.id === row.id)), ...(covers || [])] as MediaRecord[]);
  const imageFor = (entry: LibraryEntry) => entry.thumbnail || (entry.kind === "documents" || !entry.mediaId ? null : signed.get(entry.mediaId) || null);
  const editable = view === "images" || view === "documents" || view === "notes";

  const href = (n: number) => { const params = new URLSearchParams({ page: String(n) }); if (view !== "all") params.set("view", view); if (search) params.set("q", search); return `/library?${params}`; };
  return <>
    <header className="page-header"><div><p className="eyebrow">Your source archive</p><h1 className="page-title">Library</h1><p className="page-description">Every image, document, note, and reference in one place. Filter by type or search across all of them.</p></div><Link className="button" href="/library/references">New reference</Link></header>
    <form className="repository-search library-search" role="search">{view !== "all" && <input type="hidden" name="view" value={view} />}<label className="field"><span>Search {view === "all" ? "the library" : libraryLabels[view].toLowerCase()}</span><input name="q" type="search" defaultValue={search} placeholder="Titles, captions, notes, creators…" /></label><button className="button">Search</button>{search && <Link className="button" href={view === "all" ? "/library" : `/library?view=${view}`}>Clear</Link>}</form>
    <LibraryFilters active={view} search={search} counts={{ all: counts.images + counts.documents + counts.notes + counts.references, ...counts }} />
    {query.uploaded && <p className="notice notice-success">Images saved to your library.</p>}
    {(error || query.error) && <p role="alert" className="notice notice-error">{query.error || "Unable to load the library. Please retry."}</p>}
    {!error && !entries.length && <div className="empty-state"><h2>{search ? "Nothing matches that search" : view === "all" ? "Your library is empty" : `No ${libraryLabels[view].toLowerCase()} yet`}</h2><p>{search ? "Try another word or clear the search." : emptyHints[view]}</p></div>}
    <div className="library-grid">{entries.map(entry => { const image = imageFor(entry); return <article className={`library-card library-card-${entry.kind}`} key={`${entry.kind}-${entry.id}`}>
      {image ? <Link href={entry.href} className="library-card-media"><img src={image} alt={entry.altText} loading="lazy" referrerPolicy="no-referrer" /></Link> : null}
      <div className="library-card-body"><p className="library-card-type">{entry.label}</p><h2><Link href={entry.href}>{entry.title}</Link></h2>{entry.text && <p className="library-card-text">{entry.text}</p>}
      {editable && entry.kind !== "references" && <><LibraryEditor kind={entry.kind === "notes" ? "note" : "media"} id={entry.id} title={entry.title} text={entry.text} altText={entry.altText} /><DeleteContent stayOnPage kind={entry.kind === "notes" ? "note" : "media"} id={entry.id} title={entry.title} /></>}</div>
    </article>; })}</div>
    <nav className="section-actions" aria-label="Library pages"><span className="record-meta">{total} {total === 1 ? "item" : "items"}</span>{page > 1 && <Link className="button" href={href(page - 1)}>Previous</Link>}{start + entries.length < total && <Link className="button" href={href(page + 1)}>Next</Link>}</nav>
  </>;
}
