"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appendLog, diffMaps, parseLog, parseMap, researchMapParent, researchMapSnapshotParent } from "@/lib/research-map";
import { seedMap } from "@/lib/research-map-seed";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readMap(value: unknown) {
  if (JSON.stringify(value ?? null).length > 600000) throw new Error("This map is too large to save.");
  const map = parseMap(value);
  if (!map) throw new Error("This map could not be read. Refresh and try again.");
  return map;
}

// The live map is one note kept out of the Library; each save also records what changed, in words.
export async function saveResearchMap(value: unknown) {
  const map = readMap(value);
  const user = await requireUser(); const db = await createClient();
  const { data: found } = await db.from("notes").select("id,metadata").eq("owner_id", user.id).eq("parent_type", researchMapParent).limit(1).maybeSingle();
  const meta = (found?.metadata || {}) as { map?: unknown; log?: unknown };
  const before = parseMap(meta.map) || seedMap;
  const changes = diffMaps(before, map);
  const log = appendLog(parseLog(meta.log), changes, new Date().toISOString());
  const metadata = { map, log };
  const { error } = found
    ? await db.from("notes").update({ title: map.title, metadata }).eq("owner_id", user.id).eq("id", found.id)
    : await db.from("notes").insert({ owner_id: user.id, title: map.title, parent_type: researchMapParent, plain_text: "", content: [], metadata });
  if (error) throw new Error("Could not save the map. Please retry.");
  revalidatePath("/tenure/map");
  return { log };
}

// A snapshot freezes the map at a milestone, such as a third-year review, so later versions can be compared to it.
export async function saveResearchMapSnapshot(name: string, value: unknown) {
  const title = typeof name === "string" ? name.trim().slice(0, 120) : "";
  if (!title) throw new Error("Give the snapshot a name, such as “Third-year review”.");
  const map = readMap(value);
  const user = await requireUser(); const db = await createClient();
  const { data, error } = await db.from("notes").insert({ owner_id: user.id, title, parent_type: researchMapSnapshotParent, plain_text: "", content: [], metadata: { map } }).select("id,created_at").single();
  if (error || !data) throw new Error("Could not save the snapshot. Please retry.");
  revalidatePath("/tenure/map");
  return { id: data.id as string, name: title, createdAt: data.created_at as string, map };
}

export async function deleteResearchMapSnapshot(id: string) {
  if (typeof id !== "string" || !uuid.test(id)) throw new Error("That snapshot is unavailable.");
  const user = await requireUser(); const db = await createClient();
  const { error } = await db.from("notes").delete().eq("owner_id", user.id).eq("id", id).eq("parent_type", researchMapSnapshotParent);
  if (error) throw new Error("Could not delete the snapshot. Please retry.");
  revalidatePath("/tenure/map");
}
