import { createClient } from "@/lib/supabase/server";

export const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function sanitizeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getImageFiles(formData: FormData, key = "images") {
  return formData
    .getAll(key)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export async function createMediaFromFile({
  ownerId,
  file,
  storagePath,
  title,
}: {
  ownerId: string;
  file: File;
  storagePath: string;
  title?: string | null;
}) {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error(`${file.name} is not a supported image type.`);
  }

  const supabase = await createClient();
  const cleanName = sanitizeFileName(file.name) || "image";
  const { error: uploadError } = await supabase.storage
    .from("research-media")
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data, error } = await supabase
    .from("media")
    .insert({
      owner_id: ownerId,
      media_type: "image",
      title: title || cleanName,
      bucket: "research-media",
      storage_path: storagePath,
      original_filename: file.name,
      mime_type: file.type,
      byte_size: file.size,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create media record.");
  }

  return data.id as string;
}

export async function linkMediaToRecord({
  ownerId,
  mediaId,
  recordType,
  recordId,
  sortOrder,
}: {
  ownerId: string;
  mediaId: string;
  recordType: "reference" | "project";
  recordId: string;
  sortOrder: number;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("relationships").upsert(
    {
      owner_id: ownerId,
      source_type: recordType,
      source_id: recordId,
      relationship_type: "has_media",
      target_type: "media",
      target_id: mediaId,
      metadata: { sort_order: sortOrder },
    },
    { onConflict: "source_type,source_id,relationship_type,target_type,target_id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export function buildStoragePath({
  ownerId,
  recordType,
  recordId,
  fileName,
}: {
  ownerId: string;
  recordType: "references" | "projects" | "capture";
  recordId: string;
  fileName: string;
}) {
  return `${ownerId}/${recordType}/${recordId}/${crypto.randomUUID()}-${sanitizeFileName(fileName) || "image"}`;
}
