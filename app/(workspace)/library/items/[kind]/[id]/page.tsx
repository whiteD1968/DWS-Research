/* eslint-disable @next/next/no-img-element -- Authenticated, server-resized thumbnail endpoint. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSignedMediaUrl } from "@/lib/media";
import { MediaLightbox } from "@/components/media-lightbox";
import { DeleteContent, LibraryEditor } from "@/components/content-controls";
import { RecordUsage } from "@/components/record-usage";
import { PdfPageResearch } from "@/components/pdf-page-research";
import { libraryImages } from "@/lib/similar-images";
import { similarImages } from "@/lib/similar";
import { thumbnailUrl } from "@/lib/thumbnails";

export default async function LibraryItemPage({ params }: { params: Promise<{kind: string; id: string}> }) {
  const {kind,id} = await params; if (kind !== "media" && kind !== "note") notFound();
  const user = await requireUser(); const db = await createClient();
  const {data: item, error} = await db.from(kind === "media" ? "media" : "notes").select("*").eq("owner_id",user.id).eq("id",id).maybeSingle();
  if (error) throw new Error("The source could not be loaded. Please retry."); if (!item) notFound();
  const image = kind === "media" && item.media_type === "image"; const title = item.title || item.original_filename || "Untitled";
  const url = kind === "media" ? await getSignedMediaUrl(item) : null;
  const isPdf = kind === "media" && item.mime_type === "application/pdf";
  const { data: boards, error: boardsError } = isPdf ? await db.from("boards").select("id,title").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(100) : { data: [], error: null };
  if (boardsError) throw new Error("Boards could not be loaded. Please retry.");
  const images = image ? await libraryImages(db, user.id) : [];
  const self = images.find(row => row.id === id);
  const similar = self ? similarImages([id], images, 12).map(match => ({ ...match, image: images.find(row => row.id === match.id)! })) : [];
  const view = kind === "note" ? "notes" : image ? "images" : "documents";
  return <><nav className="breadcrumb-row"><Link href={`/library?view=${view}`}>Library / {view}</Link><span>/</span><span>{title}</span></nav>
    <header className="page-header"><div><p className="eyebrow">{kind === "note" ? "Working note" : image ? "Visual source" : "Document source"}</p><h1 className="page-title">{title}</h1>{item.original_filename && <p className="page-description">{item.original_filename}</p>}</div><DeleteContent kind={kind} id={id} title={title} /></header>
    <div className="source-workspace"><section className="source-main">
      {image && url && <MediaLightbox items={[{...item,signedUrl:url,sortOrder:0}]} />}
      {kind === "media" && <div className="detail-actions">{url ? <a className="button" href={url} target="_blank" rel="noreferrer">Open original ↗</a> : <p role="status">The file could not be opened. Refresh to retry.</p>}</div>}
      {kind === "media" && item.source_page && typeof item.metadata?.source_document_id === "string" && <p className="source-text"><Link href={`/library/items/media/${item.metadata.source_document_id}`}>View source PDF, page {item.source_page} ↗</Link></p>}
      <p className="source-text">{kind === "note" ? item.plain_text : item.caption}</p>
      {self && self.tags.length > 0 && <ul className="item-tags" aria-label="Tags">{self.tags.map((tag, index) => <li key={self.tagIds[index]}><Link href={`/library?view=images&tags=${encodeURIComponent(self.tagIds[index])}`}>{tag}</Link></li>)}</ul>}
      {self && <section className="similar-images" aria-labelledby="similar-heading"><h2 id="similar-heading">More like this</h2>
        {similar.length ? <ul>{similar.map(match => <li key={match.id}><Link href={`/library/items/media/${match.id}`}><img src={thumbnailUrl(match.id)} alt={match.image.title} loading="lazy" /><span>{match.shared.length ? match.shared.join(", ") : "Similar description"}</span></Link></li>)}</ul>
          : <p className="similar-empty">{self.tags.length || self.text ? "Nothing else in your Library looks close to this yet." : "Describe this image with AI in the Library to find similar ones."}</p>}
      </section>}
      {kind === "media" && typeof item.metadata?.page_text === "string" && !!item.metadata.page_text && <details><summary>Extracted page text</summary><p className="source-text">{item.metadata.page_text}</p></details>}
      {isPdf && <PdfPageResearch documentId={id} documentTitle={title} ownerId={user.id} boards={boards || []} />}
      <LibraryEditor kind={kind} id={id} title={title} text={(kind === "note" ? item.plain_text : item.caption) || ""} altText={item.alt_text || ""} />
    </section><RecordUsage kind={kind} id={id} /></div>
  </>;
}
