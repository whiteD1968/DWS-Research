/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSignedMediaUrlMap, type MediaRecord } from "@/lib/media";
import { DeleteContent, LibraryEditor } from "@/components/content-controls";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; page?: string; uploaded?: string; error?: string }> }) {
  const user = await requireUser(); const db = await createClient(); const query = await searchParams;
  const view = ["images", "documents", "notes"].includes(query.view || "") ? query.view! : "images";
  const page = Math.max(1, Math.min(10000, Number(query.page) || 1)); const start = (Math.floor(page) - 1) * 36;
  const search = (query.q || "").trim().slice(0, 120); const pattern = `%${search.replace(/[%_\\]/g, " ")}%`;
  let request = db.from(view === "notes" ? "notes" : "media").select("*", { count: "exact" }).eq("owner_id", user.id).order("updated_at", { ascending: false });
  if (view !== "notes") request = request.eq("media_type", view === "documents" ? "document" : "image");
  if (search) request = request.ilike("title", pattern);
  const { data, count, error } = await request.range(start, start + 35);
  const items = data || []; const signed = view === "notes" ? new Map<string, string | null>() : await getSignedMediaUrlMap(items as MediaRecord[]);
  const href = (n: number) => `/library?${new URLSearchParams({ view, q: search, page: String(n) })}`;
  return <>
    <header className="page-header"><div><p className="eyebrow">Your source archive</p><h1 className="page-title">Library</h1><p className="page-description">Images, documents, and notes to return to, reuse, and build upon.</p></div><Link className="button" href="/library/references">Saved references ↗</Link></header>
    <nav className="mode-tabs" aria-label="Library repositories">{["images", "documents", "notes"].map(item => <Link key={item} aria-current={view === item ? "page" : undefined} className={`mode-tab ${view === item ? "mode-tab-active" : ""}`} href={`/library?view=${item}`}>{item[0].toUpperCase() + item.slice(1)}</Link>)}<Link className="mode-tab" href="/library/references">References</Link></nav>
    <form className="repository-search" role="search"><input type="hidden" name="view" value={view} /><label className="field"><span>Find {view} by title</span><input name="q" defaultValue={search} placeholder={`Search ${view}…`} /></label><button className="button">Search</button>{search && <Link className="button" href={`/library?view=${view}`}>Clear</Link>}<span className="record-meta">{count || 0} items</span></form>
    {query.uploaded && <p className="notice notice-success">Images saved to your library.</p>}
    {(error || query.error) && <p role="alert" className="notice notice-error">{query.error || "Unable to load the library. Please retry."}</p>}
    {!error && !items.length && <div className="empty-state"><h2>{search ? "No matching items" : `Your ${view} live here`}</h2><p>{search ? "Try another title or clear your search." : view === "images" ? "Use Capture to add images. Images uploaded within projects and boards appear here too." : view === "documents" ? "Upload a PDF in a Research Topic or Project to add it to this archive." : "Notes from Research Topics and Boards appear here, ready to edit and reuse."}</p><Link className="button" href="/research">Open research</Link></div>}
    <div className={view === "images" ? "archive-grid" : "archive-list"}>{items.map(item => <article className="archive-card" key={item.id}>
      {view === "images" && signed.get(item.id) && <a href={signed.get(item.id)!} target="_blank" rel="noreferrer" aria-label={`Open ${item.title || "image"}`}><img className="archive-image" src={signed.get(item.id)!} alt={item.alt_text || item.title || ""} loading="lazy" /></a>}
      <div className="archive-card-body"><p className="eyebrow">{view === "notes" ? "Working note" : item.mime_type || view}</p><h2><Link href={`/library/items/${view === "notes" ? "note" : "media"}/${item.id}`}>{item.title || item.original_filename || "Untitled"}</Link></h2><p className="archive-caption">{view === "notes" ? item.plain_text : item.caption}</p>
      {view === "documents" && signed.get(item.id) && <a className="button" href={signed.get(item.id)!} target="_blank" rel="noreferrer">Open document ↗</a>}
      <Link className="source-details-link" href={`/library/items/${view === "notes" ? "note" : "media"}/${item.id}`}>Details &amp; used in ↗</Link>
      <LibraryEditor kind={view === "notes" ? "note" : "media"} id={item.id} title={item.title || item.original_filename || "Untitled"} text={(view === "notes" ? item.plain_text : item.caption) || ""} altText={item.alt_text || ""} />
      <DeleteContent stayOnPage kind={view === "notes" ? "note" : "media"} id={item.id} title={item.title || item.original_filename || "Untitled"} /></div>
    </article>)}</div>
    <nav className="section-actions" aria-label="Library pages">{page > 1 && <Link className="button" href={href(page - 1)}>Previous</Link>}{start + items.length < (count || 0) && <Link className="button" href={href(page + 1)}>Next</Link>}</nav>
  </>;
}
