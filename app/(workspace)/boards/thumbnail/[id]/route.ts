import sharp from "sharp";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const db = await createClient();
  const { data } = await db.from("media").select("bucket,storage_path,mime_type,byte_size").eq("id", id).eq("owner_id", user.id).single();
  if (!data?.storage_path || !["image/jpeg", "image/png", "image/webp"].includes(data.mime_type) || data.byte_size > 20 * 1024 * 1024) return new Response(null, { status: 404 });
  const file = await db.storage.from(data.bucket).download(data.storage_path);
  if (!file.data || file.data.size > 20 * 1024 * 1024) return new Response(null, { status: 404 });
  try {
    const buffer = await sharp(Buffer.from(await file.data.arrayBuffer()), { limitInputPixels: 40000000 }).rotate().resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=300", Vary: "Cookie" } });
  } catch { return new Response(null, { status: 415 }); }
}
