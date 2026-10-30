"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid, kitParent, parseKitImages, parseKitKind, type KitImage, type KitKind } from "@/lib/kit";

export async function saveKitItem(input: { id?: string; kind: KitKind; title: string; text: string; images?: KitImage[] }) {
  const kind = parseKitKind(input.kind);
  if (!kind) throw new Error("Pick what kind of material this is.");
  const title = String(input.title || "").trim().slice(0, 300);
  const text = String(input.text || "").slice(0, 60000);
  const images = kind === "image_set" ? parseKitImages(input.images) : [];
  if (!title) throw new Error("Give it a name, like “Bio — 100 words”.");
  if (kind !== "image_set" && !text.trim()) throw new Error("Add the text first.");
  if (kind === "image_set" && !images.length) throw new Error("Pick at least one image.");
  const user = await requireUser(); const db = await createClient();
  // Only the owner's own images can go in a set.
  if (images.length) {
    const { data } = await db.from("media").select("id").eq("owner_id", user.id).in("id", images.map(image => image.mediaId));
    if ((data || []).length !== images.length) throw new Error("One of those images is no longer in your Library.");
  }
  const row = { title, plain_text: text, content: [], metadata: { kind, ...(images.length ? { images } : {}) } };
  if (input.id) {
    if (!isUuid(input.id)) throw new Error("That item is unavailable.");
    const { error } = await db.from("notes").update(row).eq("owner_id", user.id).eq("parent_type", kitParent).eq("id", input.id);
    if (error) throw new Error("Could not save. Please retry.");
    revalidatePath("/kit");
    return input.id;
  }
  const { data, error } = await db.from("notes").insert({ owner_id: user.id, parent_type: kitParent, ...row }).select("id").single();
  if (error || !data) throw new Error("Could not save. Please retry.");
  revalidatePath("/kit");
  return data.id as string;
}
