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

// Saves the map as it stands into the Library: a PNG of the drawing, plus a snapshot of its data
// so the version can be reopened, compared or restored from the Library later.
export async function saveResearchMapToLibrary(formData: FormData) {
  const title = String(formData.get("name") || "").trim().slice(0, 120);
  if (!title) throw new Error("Give this version a name, such as “Third-year review”.");
  const image = formData.get("image");
  if (!(image instanceof File) || image.type !== "image/png" || !image.size) throw new Error("The map image could not be made. Please retry.");
  if (image.size > 9 * 1024 * 1024) throw new Error("The map image is too large to save.");
  let raw: unknown = null;
  try { raw = JSON.parse(String(formData.get("map") || "null")); } catch { raw = null; }
  const map = readMap(raw);
  const user = await requireUser(); const db = await createClient();
  const { data: snap, error: snapError } = await db.from("notes").insert({ owner_id: user.id, title, parent_type: researchMapSnapshotParent, plain_text: "", content: [], metadata: { map } }).select("id,created_at").single();
  if (snapError || !snap) throw new Error("Could not save this version. Please retry.");
  const snapshotId = snap.id as string;
  const fileName = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "research-map"}.png`;
  const path = `${user.id}/research-map/${snapshotId}/${fileName}`;
  const width = Math.min(20000, Math.max(1, Math.round(Number(formData.get("width")) || map.width * 2)));
  const height = Math.min(20000, Math.max(1, Math.round(Number(formData.get("height")) || map.height * 2)));
  const upload = await db.storage.from("research-media").upload(path, image, { contentType: "image/png", upsert: false });
  if (upload.error) { await db.from("notes").delete().eq("owner_id", user.id).eq("id", snapshotId); throw new Error("Could not upload the map image. Please retry."); }
  const caption = `${map.title}: version “${title}”, saved from the Research map on ${new Date().toISOString().slice(0, 10)}.${map.caption ? `\n\n${map.caption}` : ""}`;
  const { data: media, error } = await db.from("media").insert({
    owner_id: user.id, media_type: "image", title: `${map.title}: ${title}`.slice(0, 200), caption, alt_text: `${map.title}, a transit-style diagram of research strands, influences and outcomes.`,
    bucket: "research-media", storage_path: path, original_filename: fileName, mime_type: "image/png", byte_size: image.size, width, height,
    metadata: { origin: "research_map", research_map_snapshot_id: snapshotId },
  }).select("id").single();
  if (error || !media) {
    await db.storage.from("research-media").remove([path]); await db.from("notes").delete().eq("owner_id", user.id).eq("id", snapshotId);
    throw new Error("Could not add the map to the Library. Please retry.");
  }
  await db.from("notes").update({ metadata: { map, media_id: media.id } }).eq("owner_id", user.id).eq("id", snapshotId);
  revalidatePath("/tenure/map"); revalidatePath("/library");
  return { snapshot: { id: snapshotId, name: title, createdAt: snap.created_at as string, map, mediaId: media.id as string } };
}
