"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFormValue, getOptionalFormValue, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  buildStoragePath,
  createMediaFromFile,
  getImageFiles,
  linkMediaToRecord,
} from "@/lib/media-upload";

async function upsertSourceUrl({
  ownerId,
  sourceId,
  title,
  creator,
  sourceUrl,
}: {
  ownerId: string;
  sourceId: string | null;
  title: string;
  creator: string | null;
  sourceUrl: string | null;
}) {
  const supabase = await createClient();

  if (!sourceUrl) {
    return sourceId;
  }

  if (sourceId) {
    const { error } = await supabase
      .from("sources")
      .update({
        title,
        url: sourceUrl,
        creator,
      })
      .eq("id", sourceId);

    if (error) {
      throw new Error(error.message);
    }

    return sourceId;
  }

  const { data, error } = await supabase
    .from("sources")
    .insert({
      owner_id: ownerId,
      source_type: "web",
      title,
      url: sourceUrl,
      creator,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create source");
  }

  return data.id as string;
}

export async function createReference(formData: FormData) {
  const user = await requireUser();
  const title = getFormValue(formData, "title");
  const referenceType = getFormValue(formData, "reference_type");

  if (!title || !referenceType) {
    redirect("/library/references?error=reference-required");
  }

  const supabase = await createClient();
  const sourceUrl = getOptionalFormValue(formData, "source_url");
  let primarySourceId: string | null = null;

  if (sourceUrl) {
    try {
      primarySourceId = await upsertSourceUrl({
        ownerId: user.id,
        sourceId: null,
        title,
        creator: getOptionalFormValue(formData, "creator"),
        sourceUrl,
      });
    } catch (error) {
      redirect(
        `/library/references?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to create source")}`,
      );
    }
  }

  const { data, error } = await supabase
    .from("references")
    .insert({
      owner_id: user.id,
      title,
      reference_type: referenceType,
      creator: getOptionalFormValue(formData, "creator"),
      project_name: getOptionalFormValue(formData, "project_name"),
      reference_date: getOptionalFormValue(formData, "reference_date"),
      location: getOptionalFormValue(formData, "location"),
      description: getOptionalFormValue(formData, "description"),
      why_saved: getOptionalFormValue(formData, "why_saved"),
      primary_source_id: primarySourceId,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/library/references?error=${encodeURIComponent(error?.message ?? "Unknown error")}`);
  }

  revalidatePath("/library");
  revalidatePath("/library/references");
  redirect(`/library/references/${data.id}?created=1`);
}

export async function updateReference(formData: FormData) {
  const user = await requireUser();
  const referenceId = getFormValue(formData, "reference_id");
  const title = getFormValue(formData, "title");
  const referenceType = getFormValue(formData, "reference_type");
  const primarySourceId = getOptionalFormValue(formData, "primary_source_id");

  if (!referenceId || !title || !referenceType) {
    redirect("/library/references?error=reference-update-required");
  }

  let nextSourceId = primarySourceId;

  try {
    nextSourceId = await upsertSourceUrl({
      ownerId: user.id,
      sourceId: primarySourceId,
      title,
      creator: getOptionalFormValue(formData, "creator"),
      sourceUrl: getOptionalFormValue(formData, "source_url"),
    });
  } catch (error) {
    redirect(
      `/library/references/${referenceId}/edit?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to update source")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("references")
    .update({
      title,
      reference_type: referenceType,
      creator: getOptionalFormValue(formData, "creator"),
      project_name: getOptionalFormValue(formData, "project_name"),
      reference_date: getOptionalFormValue(formData, "reference_date"),
      location: getOptionalFormValue(formData, "location"),
      description: getOptionalFormValue(formData, "description"),
      why_saved: getOptionalFormValue(formData, "why_saved"),
      primary_source_id: nextSourceId,
    })
    .eq("id", referenceId);

  if (error) {
    redirect(`/library/references/${referenceId}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/library/references");
  revalidatePath(`/library/references/${referenceId}`);
  redirect(`/library/references/${referenceId}?updated=reference`);
}

export async function uploadReferenceImage(formData: FormData) {
  const user = await requireUser();
  const referenceId = getFormValue(formData, "reference_id");
  const files = getImageFiles(formData, "images");

  if (!referenceId || files.length === 0) {
    redirect("/library/references?error=image-required");
  }

  const supabase = await createClient();
  let firstMediaId: string | null = null;

  try {
    for (const [index, file] of files.entries()) {
      const mediaId = await createMediaFromFile({
        ownerId: user.id,
        file,
        storagePath: buildStoragePath({
          ownerId: user.id,
          recordType: "references",
          recordId: referenceId,
          fileName: file.name,
        }),
      });

      firstMediaId ??= mediaId;
      await linkMediaToRecord({
        ownerId: user.id,
        mediaId,
        recordType: "reference",
        recordId: referenceId,
        sortOrder: index,
      });
    }
  } catch (error) {
    redirect(`/library/references/${referenceId}?error=${encodeURIComponent(error instanceof Error ? error.message : "Upload failed")}`);
  }

  if (firstMediaId) {
    await supabase.from("references").update({ primary_media_id: firstMediaId }).eq("id", referenceId);
  }

  revalidatePath("/library/references");
  revalidatePath(`/library/references/${referenceId}`);
  redirect(`/library/references/${referenceId}?uploaded=images`);
}

export async function setReferencePrimaryMedia(formData: FormData) {
  await requireUser();
  const referenceId = getFormValue(formData, "reference_id");
  const mediaId = getFormValue(formData, "media_id");

  if (!referenceId || !mediaId) {
    redirect("/library/references?error=missing-media");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("references").update({ primary_media_id: mediaId }).eq("id", referenceId);

  if (error) {
    redirect(`/library/references/${referenceId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/library/references/${referenceId}`);
  revalidatePath("/library/references");
  redirect(`/library/references/${referenceId}?updated=primary`);
}

export async function unlinkReferenceMedia(formData: FormData) {
  await requireUser();
  const referenceId = getFormValue(formData, "reference_id");
  const mediaId = getFormValue(formData, "media_id");

  if (!referenceId || !mediaId) {
    redirect("/library/references?error=missing-media");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("relationships")
    .delete()
    .eq("source_type", "reference")
    .eq("source_id", referenceId)
    .eq("relationship_type", "has_media")
    .eq("target_type", "media")
    .eq("target_id", mediaId);

  if (error) {
    redirect(`/library/references/${referenceId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/library/references/${referenceId}`);
  redirect(`/library/references/${referenceId}?removed=media`);
}

export async function updateMediaDetails(formData: FormData) {
  await requireUser();
  const returnTo = getFormValue(formData, "return_to") ?? "/library/references";
  const mediaId = getFormValue(formData, "media_id");
  const title = getOptionalFormValue(formData, "title");
  const caption = getOptionalFormValue(formData, "caption");
  const visualType = getOptionalFormValue(formData, "visual_type");
  const drawingType = getOptionalFormValue(formData, "drawing_type");

  if (!mediaId) {
    redirect(`${returnTo}?error=missing-media`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("media")
    .update({
      title,
      caption,
      metadata: {
        visual_type: visualType,
        drawing_type: drawingType,
      },
    })
    .eq("id", mediaId);

  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(returnTo);
  redirect(`${returnTo}?updated=media`);
}
