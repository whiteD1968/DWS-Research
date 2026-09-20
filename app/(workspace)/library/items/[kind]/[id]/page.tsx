import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSignedMediaUrl } from "@/lib/media";
import { MediaLightbox } from "@/components/media-lightbox";
import { DeleteContent, LibraryEditor } from "@/components/content-controls";
import { RecordUsage } from "@/components/record-usage";

export default async function LibraryItemPage({ params }: { params: Promise<{kind: string; id: string}> }) {
  const {kind,id} = await params; if (kind !== "media" && kind !== "note") notFound();
  const user = await requireUser(); const db = await createClient();
  const {data: item, error} = await db.from(kind === "media" ? "media" : "notes").select("*").eq("owner_id",user.id).eq("id",id).maybeSingle();
  if (error) throw new Error("The source could not be loaded. Please retry."); if (!item) notFound();
  const image = kind === "media" && item.media_type === "image"; const title = item.title || item.original_filename || "Untitled";
  const url = kind === "media" ? await getSignedMediaUrl(item) : null;
  const view = kind === "note" ? "notes" : image ? "images" : "documents";
  return <><nav className="breadcrumb-row"><Link href={`/library?view=${view}`}>Library / {view}</Link><span>/</span><span>{title}</span></nav>
    <header className="page-header"><div><p className="eyebrow">{kind === "note" ? "Working note" : image ? "Visual source" : "Document source"}</p><h1 className="page-title">{title}</h1>{item.original_filename && <p className="page-description">{item.original_filename}</p>}</div><DeleteContent kind={kind} id={id} title={title} /></header>
    <div className="source-workspace"><section className="source-main">
      {image && url && <MediaLightbox items={[{...item,signedUrl:url,sortOrder:0}]} />}
      {kind === "media" && <div className="detail-actions">{url ? <a className="button" href={url} target="_blank" rel="noreferrer">Open original ↗</a> : <p role="status">The file could not be opened. Refresh to retry.</p>}</div>}
      <p className="source-text">{kind === "note" ? item.plain_text : item.caption}</p>
      <LibraryEditor kind={kind} id={id} title={title} text={(kind === "note" ? item.plain_text : item.caption) || ""} altText={item.alt_text || ""} />
    </section><RecordUsage kind={kind} id={id} /></div>
  </>;
}
