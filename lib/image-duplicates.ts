import type { SupabaseClient } from "@supabase/supabase-js";
import { looksLikeFilename } from "@/lib/image-tags";

const swap = (value: unknown, from: string, to: string) => value == null ? value : JSON.parse(JSON.stringify(value).split(from).join(to));

// Before a duplicate is deleted, everything that points at it is moved to the copy being kept:
// tags, collections, board placements, links, notes and lineage nodes. A real title or caption fills in a blank on the kept copy.
export async function moveUsesTo(db: SupabaseClient, ownerId: string, keepId: string, dropId: string) {
  const media = (table: string) => db.from(table).select("*").eq("owner_id", ownerId).eq("record_type", "media").eq("record_id", dropId);
  const [tags, collections, boardItems, sources, targets, both] = await Promise.all([
    media("record_tags"), media("collection_items"), db.from("board_items").select("board_id").eq("owner_id", ownerId).eq("record_type", "media").eq("record_id", dropId),
    db.from("relationships").select("*").eq("owner_id", ownerId).eq("source_type", "media").eq("source_id", dropId),
    db.from("relationships").select("*").eq("owner_id", ownerId).eq("target_type", "media").eq("target_id", dropId),
    db.from("media").select("id,title,original_filename,caption,alt_text").eq("owner_id", ownerId).in("id", [keepId, dropId]),
  ]);
  const problem = [tags, collections, boardItems, sources, targets, both].find(result => result.error);
  if (problem) throw new Error("Could not read where the duplicate is used. Nothing was changed.");
  const strip = <T extends Record<string, unknown>>(row: T) => { const copy: Record<string, unknown> = { ...row }; delete copy.id; delete copy.created_at; delete copy.updated_at; return copy; };
  const steps: PromiseLike<{ error: unknown }>[] = [];
  if (tags.data?.length) steps.push(db.from("record_tags").upsert(tags.data.map(row => ({ ...strip(row), record_id: keepId })), { onConflict: "record_type,record_id,tag_id", ignoreDuplicates: true }));
  if (collections.data?.length) steps.push(db.from("collection_items").upsert(collections.data.map(row => ({ ...strip(row), record_id: keepId })), { onConflict: "collection_id,record_type,record_id", ignoreDuplicates: true }));
  const moved: Record<string, unknown>[] = [...(sources.data || []).map(row => ({ ...strip(row), source_id: keepId })), ...(targets.data || []).map(row => ({ ...strip(row), target_id: keepId }))];
  const links = moved.filter(row => !(row.source_type === "media" && row.target_type === "media" && row.source_id === row.target_id));
  if (links.length) steps.push(db.from("relationships").upsert(links, { onConflict: "source_type,source_id,relationship_type,target_type,target_id", ignoreDuplicates: true }));
  steps.push(db.from("board_items").update({ record_id: keepId }).eq("owner_id", ownerId).eq("record_type", "media").eq("record_id", dropId));
  steps.push(db.from("notes").update({ parent_id: keepId }).eq("owner_id", ownerId).eq("parent_type", "media").eq("parent_id", dropId));
  steps.push(db.from("lineage_nodes").update({ record_id: keepId }).eq("owner_id", ownerId).eq("record_type", "media").eq("record_id", dropId));
  const keep = both.data?.find(row => row.id === keepId); const drop = both.data?.find(row => row.id === dropId);
  if (keep && drop) {
    const fill: Record<string, string> = {};
    if (looksLikeFilename(keep.title, keep.original_filename) && drop.title && !looksLikeFilename(drop.title, drop.original_filename)) fill.title = drop.title;
    if (!keep.caption && drop.caption) fill.caption = drop.caption;
    if (!keep.alt_text && drop.alt_text) fill.alt_text = drop.alt_text;
    if (Object.keys(fill).length) steps.push(db.from("media").update(fill).eq("owner_id", ownerId).eq("id", keepId));
  }
  const results = await Promise.all(steps);
  if (results.some(result => result.error)) throw new Error("Some uses of the duplicate couldn’t be moved. Nothing was deleted; please retry.");
  // Boards keep the image in their saved drawing and layout too, so those swap to the kept copy.
  const { data: boards } = await db.from("boards").select("id,metadata").eq("owner_id", ownerId);
  const boardIds = new Set([...(boardItems.data || []).map(row => String(row.board_id)), ...(boards || []).filter(board => JSON.stringify(board.metadata || {}).includes(dropId)).map(board => String(board.id))]);
  for (const id of boardIds) {
    const { data: board } = await db.from("boards").select("snapshot,metadata").eq("owner_id", ownerId).eq("id", id).maybeSingle();
    if (!board) continue;
    const { error } = await db.from("boards").update({ snapshot: swap(board.snapshot, dropId, keepId), metadata: swap(board.metadata, dropId, keepId) }).eq("owner_id", ownerId).eq("id", id);
    if (error) throw new Error("A board using the duplicate couldn’t be updated. Nothing was deleted; please retry.");
  }
}
