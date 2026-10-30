"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/library";
import { describeImagesFor } from "@/lib/image-tagger";

// One batch per call, so each stays inside a single request; the Library keeps calling until none are left.
export async function describeNextImages() {
  const user = await requireUser(); const db = await createClient();
  const result = await describeImagesFor(db, user.id, { limit: 9 });
  revalidatePath("/library");
  return result;
}

// Describes the selected images again, even ones already described.
export async function describeSelectedImages(ids: string[]) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 30 || !ids.every(isUuid)) throw new Error("Select up to 30 images to describe.");
  const user = await requireUser(); const db = await createClient();
  const result = await describeImagesFor(db, user.id, { ids, limit: 30 });
  revalidatePath("/library");
  return result;
}
