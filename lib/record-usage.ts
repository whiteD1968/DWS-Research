import { createClient } from "@/lib/supabase/server";
import { isRecordKind, recordHref, recordRoutes, type RecordKind } from "@/lib/records";

export type Usage = { kind: RecordKind; id: string; title: string; href: string };
export async function recordUsage(ownerId: string, kind: RecordKind, id: string): Promise<Usage[]> {
  const db = await createClient();
  const candidates = new Map<string, { kind: RecordKind; id: string }>();
  const add = (type: string, recordId: string) => {
    if (isRecordKind(type) && !(type === kind && recordId === id)) candidates.set(`${type}:${recordId}`, { kind: type, id: recordId });
  };
  // Paginate matching links so heavily reused records do not silently lose backlinks.
  async function rows(table: string, filters: Record<string, string>) {
    const result: Record<string, string>[] = [];
    for (let offset = 0; ; offset += 500) {
      let query = db.from(table).select("*").eq("owner_id", ownerId).order("id").range(offset, offset + 499);
      for (const [field, value] of Object.entries(filters)) query = query.eq(field, value);
      const { data, error } = await query;
      if (error) throw new Error("Could not load linked locations.");
      result.push(...data);
      if (data.length < 500) return result;
    }
  }
  async function generatedBoards() {
    const result: { id: string }[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from("boards").select("id").eq("owner_id", ownerId).is("snapshot", null)
        .contains("metadata", { composition: { placements: [{ key: `${kind}:${id}` }] } }).order("id").range(offset, offset + 499);
      if (error) throw new Error("Could not load generated board locations.");
      result.push(...data);
      if (data.length < 500) return result;
    }
  }
  const [incoming, outgoing, collections, placements, generated] = await Promise.all([
    rows("relationships", { target_type: kind, target_id: id }),
    rows("relationships", { source_type: kind, source_id: id }),
    rows("collection_items", { record_type: kind, record_id: id }),
    rows("board_items", { record_type: kind, record_id: id }),
    generatedBoards(),
  ]);
  incoming.forEach(link => add(link.source_type, link.source_id));
  outgoing.forEach(link => { if (["related_to", "informs_project", "derived_from"].includes(link.relationship_type)) add(link.target_type, link.target_id); });
  collections.forEach(item => add("collection", item.collection_id));
  placements.forEach(item => add("board", item.board_id));
  generated.forEach(item => add("board", item.id));
  if (kind === "media") {
    await Promise.all(([ ["reference", "primary_media_id"], ["project", "cover_media_id"], ["collection", "cover_media_id"] ] as const).map(async ([type, field]) => {
      (await rows(recordRoutes[type].table, { [field]: id })).forEach(row => add(type, row.id));
    }));
  }
  if (kind === "note") {
    const { data, error } = await db.from("notes").select("parent_type,parent_id").eq("owner_id", ownerId).eq("id", id).single();
    if (error) throw new Error("Could not load the note location.");
    if (data.parent_type && data.parent_id) add(data.parent_type, data.parent_id);
  }
  const result: Usage[] = [];
  for (const type of Object.keys(recordRoutes) as RecordKind[]) {
    const ids = [...candidates.values()].filter(item => item.kind === type).map(item => item.id);
    for (let offset = 0; offset < ids.length; offset += 100) {
      const { data, error } = await db.from(recordRoutes[type].table).select("id,title").eq("owner_id", ownerId).in("id", ids.slice(offset, offset + 100));
      if (error) throw new Error("Could not load linked locations.");
      result.push(...data.map(item => ({ kind: type, id: item.id, title: item.title || "Untitled", href: recordHref(type, item.id) })));
    }
  }
  return result.sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
}
