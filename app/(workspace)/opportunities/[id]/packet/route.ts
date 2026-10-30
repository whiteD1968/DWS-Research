import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid, kitFrom, kitParent, type KitItem } from "@/lib/kit";
import { docxHeaders, kitDocx } from "@/lib/kit-docx";
import { opportunityFrom, opportunityParent } from "@/lib/opportunities";

// Everything attached to an opportunity's checklist, in checklist order, as one Word file.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const user = await requireUser(); const db = await createClient();
  const { data } = await db.from("notes").select("id,title,plain_text,metadata").eq("owner_id", user.id).eq("parent_type", opportunityParent).eq("id", id).maybeSingle();
  const opportunity = data && opportunityFrom(data);
  if (!opportunity) return new Response("Not found", { status: 404 });
  const ids = [...new Set(opportunity.materials.flatMap(material => (material.kit ? [material.kit] : [])))];
  if (!ids.length) return new Response("Attach kit items to the checklist first.", { status: 404 });
  const { data: rows } = await db.from("notes").select("id,title,plain_text,metadata,updated_at").eq("owner_id", user.id).eq("parent_type", kitParent).in("id", ids);
  const byId = new Map((rows || []).map(kitFrom).filter((item): item is KitItem => !!item).map(item => [item.id, item]));
  const items = ids.flatMap(kitId => (byId.has(kitId) ? [byId.get(kitId)!] : []));
  if (!items.length) return new Response("The attached kit items are no longer available.", { status: 404 });
  const meta = [opportunity.organization, opportunity.deadline ? `Deadline ${new Date(`${opportunity.deadline}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}` : ""].filter(Boolean);
  const file = await kitDocx({ title: opportunity.title, meta, items });
  return new Response(new Uint8Array(file), { headers: docxHeaders(`${opportunity.title} application`) });
}
