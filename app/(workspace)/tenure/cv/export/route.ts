import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cvFields, cvParent, type CvFields } from "@/lib/cv";
import { cvDocx } from "@/lib/cv-docx";
import { studioToday } from "@/lib/journal";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Exports the chosen entries (or all of them) as a Word file whose paragraph styles map onto an InDesign template.
export async function GET(request: Request) {
  const user = await requireUser(); const db = await createClient();
  const ids = [...new Set((new URL(request.url).searchParams.get("ids") || "").split(",").filter(id => uuid.test(id)))].slice(0, 500);
  let query = db.from("notes").select("title,metadata").eq("owner_id", user.id).eq("parent_type", cvParent);
  if (ids.length) query = query.in("id", ids);
  const { data, error } = await query.limit(2000);
  if (error) return new Response("Could not load your CV entries.", { status: 500 });
  const entries = (data || []).map(cvFields).filter((entry): entry is CvFields => !!entry);
  if (!entries.length) return new Response("There are no CV entries to export yet.", { status: 404 });
  const file = await cvDocx(entries);
  return new Response(new Uint8Array(file), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename="CV-${studioToday()}.docx"`,
    "Cache-Control": "private, no-store",
  } });
}
