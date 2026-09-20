import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const db = await createClient();
  const { data, error } = await db.from("media").select("bucket,storage_path,mime_type,byte_size").eq("id", id).eq("owner_id", user.id).single();
  if (error || !data?.storage_path || data.mime_type !== "application/pdf" || !data.byte_size || data.byte_size > 20 * 1024 * 1024) return new Response("PDF unavailable", { status: 404 });
  const { data: file, error: fileError } = await db.storage.from(data.bucket).download(data.storage_path);
  if (fileError || !file || file.size > 20 * 1024 * 1024) return new Response("PDF unavailable", { status: 404 });
  return new Response(file.stream(), { headers: { "Content-Type": "application/pdf", "Cache-Control": "private, no-store", "Content-Disposition": "inline" } });
}
