import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const db = await createClient();
  const { data } = await db.from("media").select("bucket,storage_path").eq("id", id).eq("owner_id", user.id).single();
  if (!data?.storage_path) return new Response("Media unavailable", { status: 404 });
  const signed = await db.storage.from(data.bucket).createSignedUrl(data.storage_path, 300);
  if (!signed.data) return new Response("Media unavailable", { status: 404 });
  return Response.redirect(signed.data.signedUrl);
}
