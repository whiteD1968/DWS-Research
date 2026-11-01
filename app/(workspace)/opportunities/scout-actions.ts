"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { studioToday } from "@/lib/journal";
import { defaultMaterials, opportunityParent, reminderFor } from "@/lib/opportunities";
import { leadFrom, leadParent, parseSearches, parseSkip } from "@/lib/opportunity-scout";
import { scoutFor, scoutSettings } from "@/lib/scout-run";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Runs from Home on a visit; the morning email job calls scoutFor directly.
export async function runScout(force = false) {
  const user = await requireUser(); const db = await createClient();
  const result = await scoutFor(db, user.id, force);
  if (result.added) { revalidatePath("/"); revalidatePath("/opportunities"); }
  return { ran: result.ran, added: result.added };
}

export async function saveScoutSearches(text: string, skipText = "") {
  const searches = parseSearches(text); const skip = parseSkip(skipText);
  if (!searches.length) throw new Error("Add at least one search.");
  const user = await requireUser(); const db = await createClient();
  const { id, meta } = await scoutSettings(db, user.id);
  const { error } = await db.from("notes").update({ metadata: { ...meta, searches, skip, last_run: null } }).eq("owner_id", user.id).eq("id", id);
  if (error) throw new Error("Could not save the searches.");
  revalidatePath("/opportunities");
}

// Tracking turns the lead into an ordinary opportunity, keeping its link and any deadline the scout spotted.
export async function trackLead(id: string) {
  if (!uuid.test(id)) throw new Error("That lead is unavailable.");
  const user = await requireUser(); const db = await createClient();
  const { data } = await db.from("notes").select("id,title,plain_text,metadata").eq("owner_id", user.id).eq("parent_type", leadParent).eq("id", id).maybeSingle();
  const lead = data && leadFrom(data);
  if (!lead) throw new Error("That lead is unavailable. Refresh and try again.");
  const remindAt = reminderFor(lead.deadline, studioToday());
  const metadata = { kind: lead.kind, organization: lead.source, location: "", deadline: lead.deadline, url: lead.url, fee: "", award: "", status: "interested", materials: defaultMaterials(lead.kind), ...(remindAt ? { remind_at: remindAt } : {}) };
  const { error } = await db.from("notes").update({ parent_type: opportunityParent, metadata }).eq("owner_id", user.id).eq("id", id);
  if (error) throw new Error("Could not track that lead. Please retry.");
  revalidatePath("/"); revalidatePath("/opportunities");
}

export async function dismissLeads(ids: string[]) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 || !ids.every(id => uuid.test(id))) throw new Error("Nothing to dismiss.");
  const user = await requireUser(); const db = await createClient();
  const { error } = await db.from("notes").delete().eq("owner_id", user.id).eq("parent_type", leadParent).in("id", ids);
  if (error) throw new Error("Could not dismiss. Please retry.");
  revalidatePath("/"); revalidatePath("/opportunities");
}
