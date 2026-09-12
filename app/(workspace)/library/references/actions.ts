"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFormValue, getOptionalFormValue, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function sanitizeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
  const file = formData.get("image");

  if (!referenceId || !(file instanceof File) || file.size === 0) {
    redirect("/library/references?error=image-required");
  }

  if (!allowedImageTypes.has(file.type)) {
    redirect(`/library/references/${referenceId}?error=unsupported-image`);
  }

  const supabase = await createClient();
  const fileName = sanitizeFileName(file.name) || "image";
  const storagePath = `${user.id}/references/${referenceId}/${crypto.randomUUID()}-${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("research-media")
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    redirect(`/library/references/${referenceId}?error=${encodeURIComponent(uploadError.message)}`);
  }

  const { data: media, error: mediaError } = await supabase
    .from("media")
    .insert({
      owner_id: user.id,
      media_type: "image",
      title: fileName,
      bucket: "research-media",
      storage_path: storagePath,
      original_filename: file.name,
      mime_type: file.type,
      byte_size: file.size,
    })
    .select("id")
    .single();

  if (mediaError || !media) {
    redirect(
      `/library/references/${referenceId}?error=${encodeURIComponent(mediaError?.message ?? "Unable to create media record")}`,
    );
  }

  const { error: referenceError } = await supabase
    .from("references")
    .update({ primary_media_id: media.id })
    .eq("id", referenceId);

  if (referenceError) {
    redirect(`/library/references/${referenceId}?error=${encodeURIComponent(referenceError.message)}`);
  }

  revalidatePath("/library/references");
  revalidatePath(`/library/references/${referenceId}`);
  redirect(`/library/references/${referenceId}?uploaded=image`);
}
