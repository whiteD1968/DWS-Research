"use server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { boardCatalog } from "@/lib/boards/catalog";
import { generateComposition, layouts, type LayoutMode } from "@/lib/boards/layout";
import type { BoardHandoffSource } from "@/lib/boards/handoff";
import { importDiscover } from "../discover/actions";

export async function boardDestinations() {
  const user = await requireUser(); const db = await createClient();
  const { data, error } = await db.from("boards").select("id,title").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(100);
  if (error) throw new Error("Boards could not be loaded.");
  return data as { id: string; title: string }[];
}

export async function handoffToBoard(input: { source: BoardHandoffSource; selected: string[]; boardId?: string; title: string; layout: LayoutMode; requestId: string }) {
  const user = await requireUser(); const db = await createClient();
  const ids = [...new Set(input.selected)];
  if (!ids.length || ids.length > 100 || !layouts.includes(input.layout) || !/^[\da-f-]{36}$/i.test(input.requestId) || !["collection", "discover"].includes(input.source.type)) throw new Error("Select between 1 and 100 records.");
  // Validate destination before importing anything from Discover.
  if (input.boardId) {
    const { data } = await db.from("boards").select("id").eq("id", input.boardId).eq("owner_id", user.id).single();
    if (!data) throw new Error("Destination board unavailable.");
  } else if (!input.title.trim()) throw new Error("Board title required.");
  let keys: string[];
  if (input.source.type === "collection") {
    const { data: source } = await db.from("collections").select("id").eq("id", input.source.id).eq("owner_id", user.id).single();
    if (!source) throw new Error("Collection unavailable.");
    const { data: members, error } = await db.from("collection_items").select("record_id").eq("collection_id", source.id).eq("record_type", "reference").in("record_id", ids);
    if (error || members?.length !== ids.length) throw new Error("The collection selection changed. Reload and select again.");
    keys = ids.map(id => `reference:${id}`);
  } else {
    const { data: source } = await db.from("research_sessions").select("id,result_snapshot").eq("id", input.source.id).eq("owner_id", user.id).single();
    if (!source || ids.some(id => !source.result_snapshot?.some((r: { id: string }) => r.id === id))) throw new Error("Discover selection unavailable.");
    const imported = await importDiscover(source.id, ids);
    if (imported.error || !imported.savedItems) throw new Error(imported.error || "Unable to save references.");
    keys = [...new Set(ids.map(id => `reference:${imported.savedItems![id]}`))];
  }
  const catalog = await boardCatalog(user.id);
  const selected = catalog.filter(record => keys.includes(record.key));
  if (selected.length !== keys.length) throw new Error("Some references are unavailable. Saved Discover references are retained; retry the handoff.");
  if (input.boardId) return `/boards/${input.boardId}?${new URLSearchParams({ add: keys.join(","), transfer: input.requestId })}`;
  const composition = generateComposition(selected, input.layout);
  const { error } = await db.from("boards").upsert({ id: input.requestId, owner_id: user.id, title: input.title.trim().slice(0, 200), board_type: "research_generated", metadata: { generated_from: input.source.type, source_id: input.source.id, handoff_id: input.requestId, generation_version: 2, layout_mode: input.layout, selected_record_ids: keys, composition } }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error("Unable to create board. Saved references are retained; retry.");
  const { data: board } = await db.from("boards").select("id,metadata").eq("id", input.requestId).eq("owner_id", user.id).single();
  if (board?.metadata?.handoff_id !== input.requestId || board.metadata?.source_id !== input.source.id) throw new Error("Destination unavailable.");
  return `/boards/${board.id}`;
}
