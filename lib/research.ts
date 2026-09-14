import { createClient } from "@/lib/supabase/server";

export const topicStatuses = ["active", "developing", "paused", "archived"];
export const reviewFields = ["relevance_note", "key_argument", "methodology", "findings", "limitations", "research_gap"];
export const topicModes = ["overview", "discover", "literature", "precedents", "notes", "themes", "collections", "boards", "projects"];
export const topicLinks = {
  reference: { table: "references", relationship: "has_reference" },
  media: { table: "media", relationship: "has_document" },
  research_session: { table: "research_sessions", relationship: "has_discover_session" },
  project: { table: "projects", relationship: "informs_project" },
  collection: { table: "collections", relationship: "has_collection" },
  board: { table: "boards", relationship: "has_board" },
} as const;
export type TopicRecordType = keyof typeof topicLinks;
export type Topic = { id: string; title: string; question: string | null; summary: string | null; status: string; updated_at: string; metadata: Record<string, unknown> };
export type TopicLink = { id: string; source_id: string; source_type: string; target_id: string; target_type: string; relationship_type: string; note: string | null; metadata: Record<string, unknown>; created_at: string };
export type ResearchRecord = { id: string; title: string | null; name?: string; reference_type?: string; media_type?: string; mime_type?: string; primary_media_id?: string; cover_media_id?: string; bucket?: string; storage_path?: string; plain_text?: string; parent_type?: string; parent_id?: string; query?: string; created_at?: string; filters?: { contentType?: string }; result_snapshot?: unknown[]; saved_items?: Record<string, string> };

export async function ownerRows<T>(table: string, ownerId: string): Promise<T[]> {
  const db = await createClient();
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from(table).select("*").eq("owner_id", ownerId).order("id").range(offset, offset + 499);
    if (error) throw new Error(`Unable to load ${table}. Check the connection and schema.`);
    rows.push(...data as T[]);
    if (data.length < 500) return rows;
  }
}

export function isLiterature(record: ResearchRecord) {
  return ["paper", "book", "book_chapter", "report", "thesis", "standard", "academic", "journal", "article", "document"].includes(record.reference_type ?? "");
}

export async function topicContext(ownerId: string) {
  const [topics, links, references, media, sessions, projects, collections, boards, notes, tags] = await Promise.all([
    ownerRows<Topic>("research_threads", ownerId), ownerRows<TopicLink>("relationships", ownerId),
    ownerRows<ResearchRecord>("references", ownerId), ownerRows<ResearchRecord>("media", ownerId),
    ownerRows<ResearchRecord>("research_sessions", ownerId), ownerRows<ResearchRecord>("projects", ownerId),
    ownerRows<ResearchRecord>("collections", ownerId), ownerRows<ResearchRecord>("boards", ownerId),
    ownerRows<ResearchRecord>("notes", ownerId), ownerRows<ResearchRecord>("tags", ownerId),
  ]);
  return { topics, links, records: { reference: references, media, research_session: sessions, project: projects, collection: collections, board: boards, note: notes, tag: tags } };
}
