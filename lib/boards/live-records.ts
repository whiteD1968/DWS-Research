import type { SupabaseClient } from "@supabase/supabase-js";

const tables: Record<string, string> = { reference: "references", media: "media", note: "notes", project: "projects", collection: "collections", theme: "relationships" };
// Only fetch IDs that actually occur in this board, never the entire research catalog.
export async function liveRecordKeys(db: SupabaseClient, ownerId: string, items: { record_type: string; record_id: string }[]) {
  if (items.length > 500) throw new Error("Too many placements.");
  const groups = new Map<string, Set<string>>();
  for (const item of items) {
    if (!Object.hasOwn(tables, item.record_type) || !item.record_id) throw new Error("Invalid linked record.");
    if (!groups.has(item.record_type)) groups.set(item.record_type, new Set());
    groups.get(item.record_type)!.add(item.record_id);
  }
  const batches = await Promise.all([...groups].map(async ([kind, ids]) => {
    let query = db.from(tables[kind]).select("id").eq("owner_id", ownerId).in("id", [...ids]);
    if (kind === "theme") query = query.eq("source_type", "research_thread").eq("relationship_type", "has_theme").eq("target_type", "tag");
    const { data, error } = await query;
    if (error) throw new Error("Could not verify board sources. Retry saving.");
    return (data || []).map(row => `${kind}:${row.id}`);
  }));
  return new Set(batches.flat());
}
