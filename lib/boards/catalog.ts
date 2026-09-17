import { topicContext, isLiterature } from "@/lib/research";
import type { BoardRecord } from "./layout";

export async function boardCatalog(ownerId: string): Promise<BoardRecord[]> {
  const context = await topicContext(ownerId);
  const mediaById = new Map(context.records.media.map(m => [m.id, m as typeof m & { width?: number; height?: number }]));
  const text = (value: unknown) => typeof value === "string" ? value : "";
  const urls = new Map<string, string>();
  for (const media of context.records.media) if (media.storage_path && media.mime_type?.startsWith("image/")) urls.set(media.id, `/boards/thumbnail/${media.id}`);
  const themes = context.links.filter(l => l.source_type === "research_thread" && l.relationship_type === "has_theme" && l.target_type === "tag");
  const result: BoardRecord[] = [];
  for (const type of ["reference", "media", "note", "project", "collection"] as const) {
    for (const record of context.records[type]) {
      const details = record as typeof record & { creator?: string; reference_date?: string; caption?: string; description?: string; project_type?: string };
      const isDocument = type === "media" && record.mime_type === "application/pdf";
      const topicIds = context.links.filter(l => l.source_type === "research_thread" && l.target_type === type && l.target_id === record.id).map(l => l.source_id);
      if (type === "note" && record.parent_type === "research_thread" && record.parent_id) topicIds.push(record.parent_id);
      if (type === "media") {
        for (const attachment of context.links.filter(l => l.relationship_type === "has_media" && l.target_type === "media" && l.target_id === record.id)) {
          topicIds.push(...context.links.filter(l => l.source_type === "research_thread" && l.target_type === attachment.source_type && l.target_id === attachment.source_id).map(l => l.source_id));
        }
        for (const reference of context.records.reference.filter(r => r.primary_media_id === record.id)) {
          topicIds.push(...context.links.filter(l => l.source_type === "research_thread" && l.target_type === "reference" && l.target_id === reference.id).map(l => l.source_id));
        }
      }
      const imageMedia = mediaById.get(type === "media" ? record.id : record.primary_media_id || record.cover_media_id || "");
      const creator = details.creator || text(record.metadata?.author) || text(record.metadata?.creator);
      const detail = [details.reference_date, details.project_type || record.reference_type, text(record.metadata?.publication)].filter(Boolean).join(" · ");
      result.push({ key: `${type}:${record.id}`, id: record.id, type: isDocument ? "document" : type,
        title: record.title || record.original_filename || "Untitled",
        subtitle: [details.creator, details.reference_date, details.project_type, type === "media" ? record.original_filename : undefined, record.plain_text || details.caption || details.description].filter(Boolean).join(" / ").slice(0, 600),
        creator, detail, body: type === "note" ? record.plain_text || "" : undefined,
        imageWidth: imageMedia?.width, imageHeight: imageMedia?.height,
        role: isDocument || (type === "reference" && isLiterature(record)) ? "evidence" : type === "note" ? "thinking" : "visual",
        themeIds: context.links.filter(l => l.source_type === "research_topic_theme" && l.relationship_type === "includes" && l.target_type === type && l.target_id === record.id).map(l => l.source_id),
        topicIds, image: type === "media" ? (record.mime_type?.startsWith("image/") ? urls.get(record.id) : undefined) : urls.get(record.primary_media_id || record.cover_media_id || ""),
        href: type === "reference" ? `/library/references/${record.id}` : type === "project" ? `/projects/${record.id}` : type === "collection" ? `/collections/${record.id}` : type === "media" ? `/boards/source/${record.id}` : record.parent_type === "research_thread" ? `/research/${record.parent_id}?mode=notes` : record.parent_type === "project" ? `/projects/${record.parent_id}` : record.parent_type === "reference" ? `/library/references/${record.parent_id}` : "/library",
      });
    }
  }
  for (const theme of themes) {
    result.push({ key: `theme:${theme.id}`, id: theme.id, type: "theme", title: context.records.tag.find(t => t.id === theme.target_id)?.name || "Theme", subtitle: theme.note || "", role: "thinking", themeIds: [], topicIds: [theme.source_id], href: `/research/${theme.source_id}?mode=themes` });
    for (const record of result.filter(r => r.themeIds.includes(theme.id))) if (!record.topicIds.includes(theme.source_id)) record.topicIds.push(theme.source_id);
  }
  return result;
}
