import { externalImageReference } from "@/lib/discover/images";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BoardPreview, type PreviewRecord } from "./board-preview";
import { boardTopicIds, boardTopicLinks, groupBoards, organizationOptions } from "@/lib/boards/organization";

// projectId "loose" lists boards outside any project. grouped lists every board under Loose ideas and each project.
export async function BoardList({ ownerId, topicId, projectId, page = 1, preview = false, grouped = false }: { ownerId: string; topicId?: string; projectId?: string; page?: number; preview?: boolean; grouped?: boolean }) {
  const db = await createClient();
  const currentPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const pageSize = grouped ? 200 : 24;
  const offset = grouped ? 0 : (currentPage - 1) * pageSize;
  let query = db.from("boards").select("id,title,board_type,project_id,research_thread_id,created_at,updated_at,board_items(count),preview_items:board_items(record_type,record_id)").eq("owner_id", ownerId).order("updated_at", { ascending: false }).range(offset, offset + (preview ? 3 : pageSize - 1)).limit(6, { referencedTable: "preview_items" }).order("z_index", { referencedTable: "preview_items", ascending: true });
  if (topicId) {
    // A topic shows boards it started and boards tagged with it.
    const tagged = (await boardTopicLinks(db, ownerId)).filter(link => link.source_id === topicId).map(link => link.target_id).filter(id => /^[\da-f-]{36}$/i.test(id));
    query = tagged.length ? query.or(`research_thread_id.eq.${topicId},id.in.(${tagged.join(",")})`) : query.eq("research_thread_id", topicId);
  }
  if (projectId === "loose") query = query.is("project_id", null);
  else if (projectId) query = query.eq("project_id", projectId);
  const [{ data, error }, options, topicLinks] = await Promise.all([query, organizationOptions(db, ownerId), boardTopicLinks(db, ownerId)]);
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
  const projectTitle = new Map(options.projects.map(p => [p.id, p.title]));
  const topicTitle = new Map(options.topics.map(t => [t.id, t.title]));
  const card = (b: (typeof data)[number]) => {
    const topics = boardTopicIds(b, topicLinks).map(id => topicTitle.get(id)).filter(Boolean) as string[];
    return <Link href={`/boards/${b.id}`} key={b.id}>
      <BoardPreview records={b.preview_items.map(i => records.get(`${i.record_type}:${i.record_id}`) || { key: `${i.record_type}:${i.record_id}`, type: i.record_type, title: i.record_type === "theme" ? "Linked theme" : "Linked record" })} />
      <strong>{b.title}</strong>
      <span className="board-card-place">{b.project_id ? <>Project · {projectTitle.get(b.project_id) || "Unavailable"}</> : "Loose idea"}</span>
      {topics.length > 0 && <span className="board-card-topics">{topics.map(topic => <em key={topic}>{topic}</em>)}</span>}
      <small>{b.board_items[0]?.count || 0} placements · Updated {new Date(b.updated_at).toLocaleDateString("en-US")}</small></Link>;
  };
  if (grouped) {
    const groups = groupBoards(data, options.projects);
    return groups.length ? <>{groups.map(group => <section className="board-group" key={group.id ?? group.title}>
      <h2>{group.id ? <Link href={`/projects/${group.id}?mode=boards`}>{group.title}</Link> : group.title}</h2>
      {group.id === null && group.title === "Loose ideas" && <p className="board-group-note">Boards that aren’t in a project yet. Move one into a project from its title panel.</p>}
      <div className="board-list">{group.boards.map(card)}</div></section>)}</> : <p>No boards yet.</p>;
  }
  return <><div className="board-list">{data.length ? data.map(card) : <p>No boards yet.</p>}</div><nav className="board-form-row" aria-label="Board list pages">{!preview && currentPage > 1 && <Link className="button" href={`?boardPage=${currentPage - 1}`}>Previous boards</Link>}{!preview && data.length === 24 && <Link className="button" href={`?boardPage=${currentPage + 1}`}>More boards</Link>}</nav></>;
}
