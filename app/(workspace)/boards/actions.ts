"use server";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { boardCatalog } from "@/lib/boards/catalog";
import { generateComposition, layouts, type LayoutMode } from "@/lib/boards/layout";

export async function createGeneratedBoard(input: { sourceId: string; recordSelection: string[]; layoutMode: LayoutMode; title: string; manual: boolean }) {
  const user = await requireUser();
  const db = await createClient();
  const { data: topic } = await db.from("research_threads").select("id").eq("id", input.sourceId).eq("owner_id", user.id).single();
  if (!topic || !layouts.includes(input.layoutMode) || !input.title.trim()) throw new Error("Invalid board request.");
  const catalog = await boardCatalog(user.id);
  const selected = catalog.filter(r => input.recordSelection.includes(r.key) && r.topicIds.includes(topic.id));
  if (!input.manual && (!selected.length || selected.length !== new Set(input.recordSelection).size)) throw new Error("Select available topic records.");
  const composition = generateComposition(input.manual ? [] : selected, input.layoutMode, catalog.filter(r => r.type === "theme" && r.topicIds.includes(topic.id)));
  const { data, error } = await db.from("boards").insert({ owner_id: user.id, research_thread_id: topic.id, title: input.title.trim().slice(0, 200), board_type: input.manual ? "freeform" : "research_generated", metadata: { generated_from: "research_topic", source_id: topic.id, generation_version: 2, generated_at: new Date().toISOString(), layout_mode: input.layoutMode, selected_record_ids: selected.map(r => r.key), composition } }).select("id").single();
  if (error) throw new Error("Unable to create board.");
  return data.id as string;
}

async function ownedBoard(id: string) {
  const user = await requireUser();
  const db = await createClient();
  const { data, error } = await db.from("boards").select("*").eq("id", id).eq("owner_id", user.id).single();
  if (error || !data) throw new Error("Board not found.");
  return { user, db, board: data };
}

export async function saveBoard(id: string, revision: string, snapshot: unknown) {
  const { db } = await ownedBoard(id);
  const document = snapshot as { store?: Record<string, { typeName: string; type?: string; id: string; x: number; y: number; rotation: number; index: string; parentId: string; meta?: { recordKey?: string }; props: { recordKey?: string; w?: number; h?: number } }> };
  if (!document?.store || JSON.stringify(snapshot).length > 8_000_000) throw new Error("Invalid or oversized board.");
  const values = Object.values(document.store);
  if (values.some(r => r.typeName === "asset")) throw new Error("Use image upload to store media, not embedded assets.");
  const items = values.filter(r => r.typeName === "shape" && (r.type === "research-record" || (r.type === "frame" && r.meta?.recordKey?.startsWith("theme:")))).sort((a, b) => a.index.localeCompare(b.index)).map((r, i) => {
    const [type, recordId] = (r.props.recordKey || r.meta?.recordKey || "").split(":");
    return { shape_id: r.id, record_type: type, record_id: recordId, item_type: type === "theme" ? "theme" : "record", x: r.x, y: r.y, width: r.props.w, height: r.props.h, rotation: r.rotation, z_index: i, state: { parentId: r.parentId, index: r.index } };
  });
  const { data, error } = await db.rpc("save_research_board", { p_board_id: id, p_revision: revision, p_snapshot: snapshot, p_items: items });
  if (error) throw new Error(error.message.includes("another session") ? error.message : "Save failed. Check connection and board migration, then retry.");
  return data as string;
}

export async function renameBoard(id: string, title: string, description: string, revision: string) {
  const { db, user } = await ownedBoard(id);
  if (!title.trim()) throw new Error("Title required.");
  const { data, error } = await db.from("boards").update({ title: title.trim().slice(0, 200), description: description.slice(0, 4000) }).eq("id", id).eq("owner_id", user.id).eq("updated_at", revision).select("updated_at").single();
  if (error) throw new Error("Board changed or could not be renamed. Reload and retry.");
  return data.updated_at as string;
}

export async function convertBoardText(id: string, recordId: string, type: "note" | "reference", title: string, text: string) {
  const { db, user, board } = await ownedBoard(id);
  if (!["note", "reference"].includes(type) || !text.trim() || text.length > 20000 || !board.research_thread_id) throw new Error("A topic and text are required.");
  const table = type === "note" ? "notes" : "references";
  const row = type === "note" ? { parent_type: "research_thread", parent_id: board.research_thread_id, plain_text: text, content: [] } : { reference_type: "precedent", description: text };
  const { error } = await db.from(table).upsert({ id: recordId, owner_id: user.id, title: title.trim().slice(0, 200) || "Board note", ...row }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error("Unable to create record.");
  const { data: created } = await db.from(table).select("id").eq("id", recordId).eq("owner_id", user.id).single();
  if (!created) throw new Error("Record unavailable.");
  if (type === "reference") {
    const { error: linkError } = await db.from("relationships").upsert({ owner_id: user.id, source_type: "research_thread", source_id: board.research_thread_id, relationship_type: "has_reference", target_type: "reference", target_id: recordId }, { onConflict: "source_type,source_id,relationship_type,target_type,target_id", ignoreDuplicates: true });
    if (linkError) throw new Error("Could not link reference. Retry.");
  }
  const record = (await boardCatalog(user.id)).find(r => r.key === `${type}:${recordId}`);
  if (!record) throw new Error("Record unavailable.");
  return record;
}

export async function finishBoardImage(id: string, mediaId: string, extension: string, filename = "Board image") {
  const { db, user, board } = await ownedBoard(id);
  if (!/^[0-9a-f-]{36}$/.test(mediaId) || !["png", "jpeg", "webp"].includes(extension)) throw new Error("Invalid image.");
  const path = `${user.id}/boards/${id}/${mediaId}.${extension}`;
  const { data: file, error: downloadError } = await db.storage.from("research-media").download(path);
  if (downloadError || !file || file.size > 20 * 1024 * 1024) throw new Error("Image upload unavailable or too large.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const valid = extension === "png" ? bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 : extension === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!valid) throw new Error("Unsupported image content.");
  const { error } = await db.from("media").upsert({ id: mediaId, owner_id: user.id, bucket: "research-media", storage_path: path, title: filename.slice(0, 200), original_filename: filename.slice(0, 255), media_type: "image", mime_type: `image/${extension}`, byte_size: file.size }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error("Unable to register image. Retry upload.");
  const { data: created } = await db.from("media").select("id").eq("id", mediaId).eq("owner_id", user.id).single();
  if (!created) throw new Error("Image unavailable.");
  if (board.research_thread_id) {
    const { error: linkError } = await db.from("relationships").upsert({ owner_id: user.id, source_type: "research_thread", source_id: board.research_thread_id, relationship_type: "has_document", target_type: "media", target_id: mediaId }, { onConflict: "source_type,source_id,relationship_type,target_type,target_id", ignoreDuplicates: true });
    if (linkError) throw new Error("Image saved but topic link failed.");
  }
  return (await boardCatalog(user.id)).find(r => r.key === `media:${mediaId}`)!;
}
