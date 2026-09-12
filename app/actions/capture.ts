"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOptionalFormValue, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  buildStoragePath,
  createMediaFromFile,
  getImageFiles,
  linkMediaToRecord,
} from "@/lib/media-upload";

export async function captureImages(formData: FormData) {
  const user = await requireUser();
  const files = getImageFiles(formData);
  const title = getOptionalFormValue(formData, "title");
  const referenceId = getOptionalFormValue(formData, "reference_id");
  const projectId = getOptionalFormValue(formData, "project_id");
  const collectionId = getOptionalFormValue(formData, "collection_id");

  if (files.length === 0) {
    redirect("/library/references?error=image-required");
  }

  const supabase = await createClient();
  let firstMediaId: string | null = null;

  try {
    for (const [index, file] of files.entries()) {
      const recordType = referenceId ? "references" : projectId ? "projects" : "capture";
      const recordId = referenceId ?? projectId ?? "inbox";
      const mediaId = await createMediaFromFile({
        ownerId: user.id,
        file,
        storagePath: buildStoragePath({
          ownerId: user.id,
          recordType,
          recordId,
          fileName: file.name,
        }),
        title,
      });

      firstMediaId ??= mediaId;

      if (referenceId) {
        await linkMediaToRecord({
          ownerId: user.id,
          mediaId,
          recordType: "reference",
          recordId: referenceId,
          sortOrder: index,
        });
      }

      if (projectId) {
        await linkMediaToRecord({
          ownerId: user.id,
          mediaId,
          recordType: "project",
          recordId: projectId,
          sortOrder: index,
        });
      }
    }

    if (referenceId && firstMediaId) {
      await supabase.from("references").update({ primary_media_id: firstMediaId }).eq("id", referenceId);
    }

    if (projectId && firstMediaId) {
      await supabase.from("projects").update({ cover_media_id: firstMediaId }).eq("id", projectId);
    }

    if (collectionId && referenceId) {
      await supabase.from("collection_items").upsert(
        {
          owner_id: user.id,
          collection_id: collectionId,
          record_type: "reference",
          record_id: referenceId,
        },
        { onConflict: "collection_id,record_type,record_id" },
      );
    }
  } catch (error) {
    redirect(`/library/references?error=${encodeURIComponent(error instanceof Error ? error.message : "Upload failed")}`);
  }

  revalidatePath("/library/references");
  revalidatePath("/projects");
  revalidatePath("/collections");

  if (referenceId) {
    revalidatePath(`/library/references/${referenceId}`);
    redirect(`/library/references/${referenceId}?uploaded=images`);
  }

  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
    redirect(`/projects/${projectId}?uploaded=images`);
  }

  redirect("/library/references?uploaded=images");
}
