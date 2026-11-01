"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/library";
import { fingerprintImages, markDistinct, saveFingerprints } from "@/lib/image-fingerprints";
import { moveUsesTo } from "@/lib/image-duplicates";
import { deleteContent } from "@/app/actions/content";

// Production hides the text of errors thrown by server actions, so failures come back as values the page can show.
async function safely<T>(work: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try { return { ok: true, value: await work() }; }
  catch (problem) { return { ok: false, error: problem instanceof Error ? problem.message : "Something went wrong. Please retry." }; }
}

// One batch per call, so each stays inside a single request; the page keeps calling until every image has a fingerprint.
export async function fingerprintNextImages() { return safely(async () => {
  const user = await requireUser(); const db = await createClient();
  return fingerprintImages(db, user.id, { limit: 24, deadline: Date.now() + 40000 });
}); }

// Keeps one image and deletes the others, after moving their tags, collections, board spots and links onto it.
export async function keepOneImage(keepId: string, dropIds: string[]) { return safely(async () => {
  if (!isUuid(keepId) || !Array.isArray(dropIds) || !dropIds.length || dropIds.length > 20 || !dropIds.every(isUuid) || dropIds.includes(keepId)) throw new Error("Pick one image to keep. Refresh and try again.");
  const user = await requireUser(); const db = await createClient();
  const { data } = await db.from("media").select("id").eq("owner_id", user.id).eq("media_type", "image").in("id", [keepId, ...dropIds]);
  if ((data || []).length !== dropIds.length + 1) throw new Error("Some of these images are no longer in the Library. Refresh the page.");
  let deleted = 0;
  for (const dropId of dropIds) {
    await moveUsesTo(db, user.id, keepId, dropId);
    await deleteContent("media", dropId, "DELETE");
    deleted += 1;
  }
  await saveFingerprints(db, user.id, { remove: dropIds });
  revalidatePath("/library"); revalidatePath("/library/duplicates");
  return deleted;
}); }

// Marks a group as not duplicates, so it isn't suggested again.
export async function notDuplicates(ids: string[]) { return safely(async () => {
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > 20 || !ids.every(isUuid)) throw new Error("Refresh and try again.");
  const user = await requireUser(); const db = await createClient();
  await markDistinct(db, user.id, ids);
  revalidatePath("/library/duplicates");
}); }
