import { createClient } from "@/lib/supabase/server";

export type MediaRecord = {
  id: string;
  bucket: string;
  storage_path: string | null;
  title?: string | null;
  original_filename?: string | null;
  mime_type?: string | null;
  byte_size?: number | null;
  alt_text?: string | null;
  caption?: string | null;
  metadata?: Record<string, unknown> | null;
  source_url?: string | null;
  created_at?: string | null;
};

export async function getSignedMediaUrl(media: MediaRecord | null | undefined) {
  if (!media?.storage_path) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(media.bucket)
    .createSignedUrl(media.storage_path, 60 * 60);

  if (error) {
    return null;
  }

  return data.signedUrl;
}

export async function getSignedMediaUrlMap(media: MediaRecord[]) {
  const entries = await Promise.all(
    media.map(async (item) => [item.id, await getSignedMediaUrl(item)] as const),
  );

  return new Map(entries);
}

export function getImageAlt(media: Pick<MediaRecord, "alt_text" | "caption"> | null | undefined) {
  return media?.alt_text ?? media?.caption ?? "";
}

export type MediaRelationship = {
  target_id: string;
  metadata: Record<string, unknown> | null;
};

export type SignedMediaItem = MediaRecord & {
  signedUrl: string | null;
  sortOrder: number;
};

export function getRelationshipSortOrder(relationship: MediaRelationship) {
  const sortOrder = relationship.metadata?.sort_order;
  return typeof sortOrder === "number" ? sortOrder : 0;
}
