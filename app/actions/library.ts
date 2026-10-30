"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/library";
import { deleteContent } from "@/app/actions/content";

const maxBatch = 200;

// Every batch action starts by confirming the selected files belong to the signed-in owner.
async function ownedMedia(ids: unknown) {
  const user = await requireUser();
  if (!Array.isArray(ids) || !ids.length || ids.length > maxBatch || !ids.every(isUuid)) throw new Error(`Select between 1 and ${maxBatch} items.`);
  const db = await createClient();
  const { data, error } = await db.from("media").select("id").eq("owner_id", user.id).in("id", ids);
  if (error) throw new Error("Could not check the selected items. Please retry.");
  if (data.length !== new Set(ids).size) throw new Error("Some selected items are no longer available. Refresh and try again.");
  return { user, db, ids: data.map(row => row.id as string) };
}

export async function tagMedia(ids: string[], name: string) {
  const tagName = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (!tagName || tagName.length > 60) throw new Error("Enter a tag of up to 60 characters.");
  const { user, db, ids: media } = await ownedMedia(ids);
  const { data: tag, error } = await db.from("tags").upsert({ owner_id: user.id, name: tagName }, { onConflict: "owner_id,name" }).select("id").single();
  if (error || !tag) throw new Error("Could not create that tag. Please retry.");
  const rows = media.map(id => ({ owner_id: user.id, record_type: "media", record_id: id, tag_id: tag.id }));
  const linked = await db.from("record_tags").upsert(rows, { onConflict: "record_type,record_id,tag_id", ignoreDuplicates: true });
  if (linked.error) throw new Error("Could not tag the selected items. Please retry.");
  revalidatePath("/library");
}

export async function untagMedia(ids: string[], tagId: string) {
  if (!isUuid(tagId)) throw new Error("Choose a tag to remove.");
  const { user, db, ids: media } = await ownedMedia(ids);
  const { error } = await db.from("record_tags").delete().eq("owner_id", user.id).eq("record_type", "media").eq("tag_id", tagId).in("record_id", media);
  if (error) throw new Error("Could not remove that tag. Please retry.");
  revalidatePath("/library");
}

export async function addMediaToProject(ids: string[], projectId: string) {
  if (!isUuid(projectId)) throw new Error("Choose a project.");
  const { user, db, ids: media } = await ownedMedia(ids);
  const { data: project } = await db.from("projects").select("id").eq("owner_id", user.id).eq("id", projectId).maybeSingle();
  if (!project) throw new Error("That project is unavailable. Refresh and try again.");
  const { data: rows, error: typeError } = await db.from("media").select("id,media_type").eq("owner_id", user.id).in("id", media);
  if (typeError) throw new Error("Could not check the selected items. Please retry.");
  // Projects keep images and documents under separate link types, matching how the project page reads them.
  const links = rows.map(row => ({ owner_id: user.id, source_type: "project", source_id: projectId, relationship_type: row.media_type === "document" ? "has_document" : "has_media", target_type: "media", target_id: row.id }));
  const { error } = await db.from("relationships").upsert(links, { onConflict: "source_type,source_id,relationship_type,target_type,target_id", ignoreDuplicates: true });
  if (error) throw new Error("Could not add the selected items to that project. Please retry.");
  revalidatePath("/library");
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteMediaMany(ids: string[], confirmation: string) {
  if (confirmation !== "DELETE") throw new Error("Confirm the deletion by typing DELETE.");
  const { ids: media } = await ownedMedia(ids);
  // One at a time through the single-item path, so each file is removed from storage before its record.
  let deleted = 0;
  for (const id of media) {
    try { await deleteContent("media", id, confirmation); deleted += 1; }
    catch { throw new Error(`${deleted} of ${media.length} deleted. The rest could not be removed; refresh and retry.`); }
  }
  revalidatePath("/library");
  return deleted;
}
