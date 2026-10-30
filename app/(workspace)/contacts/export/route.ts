import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { studioToday } from "@/lib/journal";
import { contactFrom, contactParent, contactsCsv, sortContacts, type Contact } from "@/lib/contacts";

export async function GET() {
  const user = await requireUser(); const db = await createClient();
  const { data, error } = await db.from("notes").select("id,title,plain_text,metadata").eq("owner_id", user.id).eq("parent_type", contactParent).limit(5000);
  if (error) return new Response("Could not load your contacts.", { status: 500 });
  const contacts = (data || []).map(contactFrom).filter((contact): contact is Contact => !!contact).sort(sortContacts);
  return new Response(`﻿${contactsCsv(contacts)}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="contacts-${studioToday()}.csv"`, "Cache-Control": "private, no-store" } });
}
