import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/library";
import { thumbnailBucket, thumbnailPath, thumbnailWidth } from "@/lib/thumbnails";

// One stable address per image, so the browser keeps thumbnails cached between visits.
const cached = (bytes: ArrayBuffer | Uint8Array) => new Response(bytes as BodyInit, { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=2592000, immutable" } });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const { data: media } = await db.from("media").select("id,bucket,storage_path,media_type").eq("owner_id", user.id).eq("id", id).maybeSingle();
  if (!media?.storage_path || media.media_type !== "image") return new Response("Not found", { status: 404 });

  const path = thumbnailPath(user.id, id);
  const existing = await db.storage.from(thumbnailBucket).download(path);
  if (existing.data) return cached(await existing.data.arrayBuffer());

  // First request for this image: shrink the original once and keep the result in storage.
  // The media row is left alone so its updated_at, and its place in the library, do not change.
  const original = await db.storage.from(media.bucket).download(media.storage_path);
  if (!original.data) return new Response("Image unavailable", { status: 404 });
  let bytes: Buffer;
  try {
    bytes = await sharp(Buffer.from(await original.data.arrayBuffer()), { failOn: "none" }).rotate().resize({ width: thumbnailWidth, height: thumbnailWidth * 1.5, fit: "inside", withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
  } catch {
    return new Response("Image could not be read", { status: 415 });
  }
  await db.storage.from(thumbnailBucket).upload(path, bytes, { contentType: "image/webp", upsert: true });
  return cached(bytes);
}
