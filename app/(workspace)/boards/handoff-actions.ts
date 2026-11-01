"use server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { boardCatalog } from "@/lib/boards/catalog";
import { generateComposition, layouts, type LayoutMode } from "@/lib/boards/layout";
import type { BoardHandoffSource } from "@/lib/boards/handoff";
import { importDiscover } from "../discover/actions";
import { groupBoards, isUuid, organizationOptions } from "@/lib/boards/organization";

// Boards grouped as Loose ideas, then by project, so it is clear where a selection goes.
export async function boardDestinations() {
  const user = await requireUser(); const db = await createClient();
  const [{ data, error }, options] = await Promise.all([db.from("boards").select("id,title,project_id").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(200), organizationOptions(db, user.id)]);
  if (error) throw new Error("Boards could not be loaded.");
  const groups = groupBoards(data as { id: string; title: string; project_id: string | null }[], options.projects).map(group => ({ title: group.title, boards: group.boards.map(({ id, title }) => ({ id, title })) }));
  return { groups, projects: options.projects };
}

export async function handoffToBoard(input: { source: BoardHandoffSource; selected: string[]; boardId?: string; title: string; layout: LayoutMode; requestId: string; projectId?: string }) {
  const user = await requireUser(); const db = await createClient();
  const ids = [...new Set(input.selected)];
  if (!ids.length || ids.length > 100 || !layouts.includes(input.layout) || !/^[\da-f-]{36}$/i.test(input.requestId) || !["collection", "discover", "library"].includes(input.source.type)) throw new Error("Select between 1 and 100 records.");
  // Validate destination before importing anything from Discover.
  if (input.boardId) {
    const { data } = await db.from("boards").select("id").eq("id", input.boardId).eq("owner_id", user.id).single();
    if (!data) throw new Error("Destination board unavailable.");
  } else if (!input.title.trim()) throw new Error("Board title required.");
  else if (input.projectId) {
    const { data } = isUuid(input.projectId) ? await db.from("projects").select("id").eq("id", input.projectId).eq("owner_id", user.id).single() : { data: null };
    if (!data) throw new Error("That project is unavailable.");
  }
  let keys: string[];
  if (input.source.type === "library") {
    // Library items are linked, never moved: the board holds cards pointing at the same media rows.
    if (ids.some(id => !/^[\da-f-]{36}$/i.test(id))) throw new Error("Select Library images again.");
    keys = ids.map(id => `media:${id}`);
  } else if (input.source.type === "collection") {
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
  if (selected.length !== keys.length) throw new Error(input.source.type === "library" ? "Some selected items are no longer in your Library. Reload and select again." : "Some references are unavailable. Saved Discover references are retained; retry the handoff.");
  if (input.boardId) return `/boards/${input.boardId}?${new URLSearchParams({ add: keys.join(","), transfer: input.requestId })}`;
  const composition = generateComposition(selected, input.layout);
  const { error } = await db.from("boards").upsert({ id: input.requestId, owner_id: user.id, project_id: !input.boardId && input.projectId ? input.projectId : null, title: input.title.trim().slice(0, 200), board_type: "research_generated", metadata: { generated_from: input.source.type, source_id: input.source.id, handoff_id: input.requestId, generation_version: 2, layout_mode: input.layout, selected_record_ids: keys, composition } }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error("Unable to create board. Saved references are retained; retry.");
  const { data: board } = await db.from("boards").select("id,metadata").eq("id", input.requestId).eq("owner_id", user.id).single();
  if (board?.metadata?.handoff_id !== input.requestId || board.metadata?.source_id !== input.source.id) throw new Error("Destination unavailable.");
  return `/boards/${board.id}`;
}
