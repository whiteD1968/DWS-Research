import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid, kitFrom, kitParent } from "@/lib/kit";
import { docxHeaders, kitDocx, kitFileName } from "@/lib/kit-docx";

// One kit item as a Word file: an image set becomes a numbered image list.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const user = await requireUser(); const db = await createClient();
  const { data } = await db.from("notes").select("id,title,plain_text,metadata,updated_at").eq("owner_id", user.id).eq("parent_type", kitParent).eq("id", id).maybeSingle();
  const item = data && kitFrom(data);
  if (!item) return new Response("Not found", { status: 404 });
  const file = await kitDocx({ title: item.kind === "image_set" ? `${item.title}: image list` : item.title, items: [item] });
  return new Response(new Uint8Array(file), { headers: docxHeaders(kitFileName(item)) });
}
