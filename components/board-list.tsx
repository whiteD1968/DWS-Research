import { externalImageReference } from "@/lib/discover/images";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BoardPreview, type PreviewRecord } from "./board-preview";
export async function BoardList({ ownerId, topicId, page = 1 }: { ownerId: string; topicId?: string; page?: number }) {
  const db = await createClient();
  const currentPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const offset = (currentPage - 1) * 24;
  let query = db.from("boards").select("id,title,board_type,created_at,updated_at,board_items(count),preview_items:board_items(record_type,record_id)").eq("owner_id", ownerId).order("updated_at", { ascending: false }).range(offset, offset + 23).limit(6, { referencedTable: "preview_items" }).order("z_index", { referencedTable: "preview_items", ascending: true });
  if (topicId) query = query.eq("research_thread_id", topicId);
  const { data, error } = await query;
  if (error) return <p role="alert">Boards could not be loaded.</p>;
  const items = data.flatMap(b => b.preview_items);
  const records = new Map<string, PreviewRecord>();
  const imageIds = new Map<string, string>();
  // Fetch only visible preview sources, never full snapshots or the entire owner catalog.
  const types = [["reference", "references", "primary_media_id"], ["project", "projects", "cover_media_id"], ["collection", "collections", "cover_media_id"], ["note", "notes", ""]];
  await Promise.all(types.map(async ([type, table, imageColumn]) => {
    const ids = [...new Set(items.filter(i => i.record_type === type).map(i => i.record_id))];
    if (!ids.length) return;
    const { data: sources } = await db.from(table).select(`id,title${type === "reference" ? ",metadata" : ""}${imageColumn ? `,${imageColumn}` : ""}`).eq("owner_id", ownerId).in("id", ids);
    for (const source of (sources || []) as unknown as { id: string; title: string; primary_media_id?: string; cover_media_id?: string; metadata?: Record<string, unknown> }[]) {
      const key = `${type}:${source.id}`;
      records.set(key, { key, type, title: source.title, image: type === "reference" ? externalImageReference(source.metadata)?.thumbnail : undefined });
      const imageId = source.primary_media_id || source.cover_media_id;
      if (imageId) imageIds.set(key, imageId);
    }
  }));
  const themeIds = [...new Set(items.filter(i => i.record_type === "theme").map(i => i.record_id))];
  if (themeIds.length) {
    const { data: themes } = await db.from("relationships").select("id,target_id").eq("owner_id", ownerId).eq("relationship_type", "has_theme").in("id", themeIds);
    if (themes?.length) {
      const { data: tags } = await db.from("tags").select("id,name").eq("owner_id", ownerId).in("id", themes.map(t => t.target_id));
      for (const theme of themes) { const key = `theme:${theme.id}`; records.set(key, { key, type: "theme", title: tags?.find(t => t.id === theme.target_id)?.name || "Linked theme" }); }
    }
  }
  const mediaIds = [...new Set([...imageIds.values(), ...items.filter(i => i.record_type === "media").map(i => i.record_id)])];
  if (mediaIds.length) {
    const { data: media } = await db.from("media").select("id,title,original_filename,mime_type").eq("owner_id", ownerId).in("id", mediaIds);
    for (const item of media || []) {
      const image = item.mime_type?.startsWith("image/") ? `/boards/thumbnail/${item.id}` : undefined;
      const key = `media:${item.id}`;
      records.set(key, { key, type: image ? "image" : "document", title: item.title || item.original_filename || "Document", image });
      if (image) for (const [recordKey, imageId] of imageIds) if (imageId === item.id) records.get(recordKey)!.image = image;
    }
  }
  return <><div className="board-list">{data.length ? data.map(b => <Link href={`/boards/${b.id}`} key={b.id}>
    <BoardPreview records={b.preview_items.map(i => records.get(`${i.record_type}:${i.record_id}`) || { key: `${i.record_type}:${i.record_id}`, type: i.record_type, title: i.record_type === "theme" ? "Linked theme" : "Linked record" })} />
    <strong>{b.title}</strong><span>{b.board_type.replaceAll("_", " ")} / {b.board_items[0]?.count || 0} placements</span><small>Updated {new Date(b.updated_at).toLocaleDateString("en-US")}</small></Link>) : <p>No boards yet.</p>}</div><nav className="board-form-row" aria-label="Board list pages">{currentPage > 1 && <Link className="button" href={`?boardPage=${currentPage - 1}`}>Previous boards</Link>}{data.length === 24 && <Link className="button" href={`?boardPage=${currentPage + 1}`}>More boards</Link>}</nav></>;
}
