/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { libraryPattern } from "@/lib/library";
import { thumbnailUrl } from "@/lib/thumbnails";
import { entryDay, formatDay, groupByDay, journalPageSize, journalParent } from "@/lib/journal";
import { recordHref } from "@/lib/records";
import { JournalComposer } from "@/components/journal-composer";
import { DeleteContent, LibraryEditor } from "@/components/content-controls";

type Row = Record<string, unknown>;

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; sketches?: string }> }) {
  const user = await requireUser(); const db = await createClient(); const query = await searchParams;
  const page = Math.max(1, Math.min(1000, Math.floor(Number(query.page) || 1))); const start = (page - 1) * journalPageSize;
  const search = (query.q || "").trim().slice(0, 120); const pattern = libraryPattern(search);
  const sketchesOnly = query.sketches === "1";

  // "With images" narrows to entries that have at least one attached sketch or photo.
  let withImages: string[] | null = null;
  if (sketchesOnly) {
    const { data } = await db.from("relationships").select("source_id").eq("owner_id", user.id).eq("source_type", "note").eq("relationship_type", "has_media").limit(5000);
    withImages = [...new Set((data || []).map(row => String(row.source_id)))];
  }
  let request = db.from("notes").select("id,title,plain_text,metadata,created_at,updated_at", { count: "exact" }).eq("owner_id", user.id).eq("parent_type", journalParent);
  if (pattern) request = request.or(`title.ilike.${pattern},plain_text.ilike.${pattern}`);
  if (withImages) request = request.in("id", withImages.length ? withImages.slice(0, 300) : ["00000000-0000-0000-0000-000000000000"]);
  const { data: rows, count, error } = await request.order("metadata->>entry_date", { ascending: false }).order("created_at", { ascending: false }).range(start, start + journalPageSize - 1);
  const entries = (rows || []) as Row[]; const ids = entries.map(entry => String(entry.id));

  const [media, linked, projects, topics] = await Promise.all([
    ids.length ? db.from("relationships").select("source_id,target_id,metadata").eq("owner_id", user.id).eq("source_type", "note").eq("relationship_type", "has_media").in("source_id", ids).then(result => result.data || []) : [],
    ids.length ? db.from("relationships").select("source_type,source_id,target_id").eq("owner_id", user.id).eq("relationship_type", "has_note").eq("target_type", "note").in("target_id", ids).then(result => result.data || []) : [],
    db.from("projects").select("id,title").eq("owner_id", user.id).order("title").limit(300).then(result => result.data || []),
    db.from("research_threads").select("id,title").eq("owner_id", user.id).order("title").limit(300).then(result => result.data || []),
  ]);
  const imagesFor = (id: string) => (media as Row[]).filter(row => row.source_id === id).sort((a, b) => Number((a.metadata as Row)?.sort_order ?? 0) - Number((b.metadata as Row)?.sort_order ?? 0)).map(row => String(row.target_id));
  const titles = new Map<string, string>([...projects.map(row => [`project:${row.id}`, row.title] as [string, string]), ...topics.map(row => [`research_thread:${row.id}`, row.title] as [string, string])]);
  const linksFor = (id: string) => (linked as Row[]).filter(row => row.target_id === id).map(row => ({ key: `${row.source_type}:${row.source_id}`, href: recordHref(row.source_type as "project" | "research_thread", String(row.source_id)) })).filter(link => titles.has(link.key));
  const total = count || 0; const today = new Date().toISOString().slice(0, 10);
  const href = (next: { page?: number; sketches?: boolean; q?: string }) => { const params = new URLSearchParams(); const q = next.q ?? search; if (q) params.set("q", q); if (next.sketches ?? sketchesOnly) params.set("sketches", "1"); if ((next.page ?? 1) > 1) params.set("page", String(next.page)); const value = params.toString(); return value ? `/journal?${value}` : "/journal"; };

  return <>
    <header className="page-header"><div><p className="eyebrow">Studio journal</p><h1 className="page-title">Journal</h1><p className="page-description">Write, sketch, and photograph ideas as they come. Sketches and photos also land in your Library, tagged “journal”.</p></div></header>
    <JournalComposer today={today} links={[{ label: "Projects", options: projects.map(row => ({ value: `project:${row.id}`, label: row.title || "Untitled" })) }, { label: "Research topics", options: topics.map(row => ({ value: `research_thread:${row.id}`, label: row.title || "Untitled" })) }]} />
    <div className="journal-tools">
      <form className="journal-search" role="search">{sketchesOnly && <input type="hidden" name="sketches" value="1" />}<input name="q" type="search" defaultValue={search} placeholder="Search entries…" aria-label="Search entries" /><button className="button">Search</button>{search && <Link className="text-button" href={href({ q: "" })}>Clear</Link>}</form>
      <nav className="library-layouts" aria-label="Show"><Link href={href({ sketches: false })} aria-current={!sketchesOnly ? "page" : undefined}>All entries</Link><Link href={href({ sketches: true })} aria-current={sketchesOnly ? "page" : undefined}>With sketches & photos</Link></nav>
      <span className="record-meta">{total} {total === 1 ? "entry" : "entries"}</span>
    </div>
    {error && <p role="alert" className="notice notice-error">Unable to load the journal. Please retry.</p>}
    {!error && !entries.length && <div className="empty-state"><h2>{search || sketchesOnly ? "No entries match" : "Your journal is empty"}</h2><p>{search || sketchesOnly ? "Try another word or show all entries." : "Write your first entry above. A sentence or a quick sketch is enough."}</p></div>}
    <div className="journal-feed">{groupByDay(entries, entryDay).map(group => <section key={group.day} className="journal-day" aria-label={formatDay(group.day)}>
      <h2 className="journal-day-title">{formatDay(group.day)}</h2>
      {group.entries.map(entry => { const id = String(entry.id); const images = imagesFor(id); const title = String(entry.title || ""); return <article key={id} className="journal-entry">
        {title && <h3><Link href={`/library/items/note/${id}`}>{title}</Link></h3>}
        {entry.plain_text ? <p className="journal-entry-text">{String(entry.plain_text)}</p> : null}
        {images.length > 0 && <ul className={`journal-entry-images journal-entry-images-${Math.min(images.length, 3)}`}>{images.map(mediaId => <li key={mediaId}><Link href={`/library/items/media/${mediaId}`}><img src={thumbnailUrl(mediaId)} alt={title ? `Image for ${title}` : "Journal image"} loading="lazy" /></Link></li>)}</ul>}
        <div className="journal-entry-foot">{linksFor(id).map(link => <Link key={link.key} className="library-tag" href={link.href}>{titles.get(link.key)}</Link>)}<Link className="text-button" href={`/library/items/note/${id}`}>Open</Link><LibraryEditor kind="note" id={id} title={title || "Journal entry"} text={String(entry.plain_text || "")} /><DeleteContent stayOnPage kind="note" id={id} title={title || formatDay(group.day)} /></div>
      </article>; })}
    </section>)}</div>
    <nav className="section-actions" aria-label="Journal pages">{page > 1 && <Link className="button" href={href({ page: page - 1 })}>Newer</Link>}{start + entries.length < total && <Link className="button" href={href({ page: page + 1 })}>Older</Link>}</nav>
  </>;
}
