"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { recordRoutes } from "@/lib/records";
import { dossierParent, dossierSettingsParent, evidenceKinds, evidenceLabels, evidenceType, parseEvidence, parseReviewDate, parseSection } from "@/lib/dossier";
import { evidenceRow, sectionNoteId } from "@/lib/dossier-server";

function section(value: unknown) {
  const key = parseSection(value);
  if (!key) throw new Error("Choose a dossier section.");
  return key;
}

export async function saveStatement(sectionKey: string, text: string) {
  const key = section(sectionKey);
  if (typeof text !== "string" || text.length > 50000) throw new Error("This statement is too long to save.");
  const user = await requireUser(); const db = await createClient();
  const id = await sectionNoteId(db, user.id, key);
  const { error } = await db.from("notes").update({ plain_text: text }).eq("owner_id", user.id).eq("id", id);
  if (error) throw new Error("Could not save the statement. Please retry.");
  revalidatePath("/tenure");
}

export async function addEvidence(sectionKey: string, value: string) {
  const key = section(sectionKey); const target = parseEvidence(value);
  if (!target) throw new Error("Choose something to add.");
  const user = await requireUser(); const db = await createClient();
  const { data } = await db.from(recordRoutes[target.kind].table).select("id").eq("owner_id", user.id).eq("id", target.id).maybeSingle();
  if (!data) throw new Error("That item is unavailable. Refresh and try again.");
  const id = await sectionNoteId(db, user.id, key);
  if (target.kind === "note" && target.id === id) throw new Error("A statement can't be its own evidence.");
  const { error } = await db.from("relationships").upsert(evidenceRow(user.id, id, target.kind, target.id), { onConflict: "source_type,source_id,relationship_type,target_type,target_id", ignoreDuplicates: true });
  if (error) throw new Error("Could not add that item. Please retry.");
  revalidatePath("/tenure");
}

export async function removeEvidence(relationshipId: string) {
  if (typeof relationshipId !== "string" || !/^[0-9a-f-]{36}$/i.test(relationshipId)) throw new Error("That item is unavailable.");
  const user = await requireUser(); const db = await createClient();
  const { error } = await db.from("relationships").delete().eq("owner_id", user.id).eq("id", relationshipId).eq("relationship_type", evidenceType);
  if (error) throw new Error("Could not remove that item. Please retry.");
  revalidatePath("/tenure");
}

// The review date lives on a small settings note, kept out of the Library.
export async function setReviewDate(value: string) {
  const day = value === "" ? null : parseReviewDate(value);
  if (value !== "" && !day) throw new Error("Choose a valid date.");
  const user = await requireUser(); const db = await createClient();
  const { data: found } = await db.from("notes").select("id,metadata").eq("owner_id", user.id).eq("parent_type", dossierSettingsParent).limit(1).maybeSingle();
  const metadata = { ...((found?.metadata as Record<string, unknown>) || {}), review_date: day };
  const { error } = found
    ? await db.from("notes").update({ metadata }).eq("owner_id", user.id).eq("id", found.id)
    : await db.from("notes").insert({ owner_id: user.id, title: "Tenure dossier settings", parent_type: dossierSettingsParent, plain_text: "", content: [], metadata });
  if (error) throw new Error("Could not save the review date. Please retry.");
  revalidatePath("/tenure");
}

// Finds anything in the workspace by title, so it can be added as evidence.
export async function searchEvidence(query: string) {
  const text = typeof query === "string" ? query.replace(/[%_\\,()*"]/g, " ").trim().slice(0, 120) : "";
  if (text.length < 2) return [];
  const user = await requireUser(); const db = await createClient();
  const results = await Promise.all(evidenceKinds.map(async kind => {
    let request = db.from(recordRoutes[kind].table).select(kind === "media" ? "id,title,original_filename" : "id,title").eq("owner_id", user.id).ilike("title", `%${text}%`);
    if (kind === "note") request = request.or(`parent_type.is.null,parent_type.not.in.(${dossierParent},${dossierSettingsParent},opportunity_settings,opportunity_lead,calendar_settings,digest_settings,zotero_settings,pinterest_settings)`);
    const { data } = await request.order("updated_at", { ascending: false }).limit(5);
    return ((data || []) as unknown as { id: string; title: string | null; original_filename?: string | null }[]).map(row => ({ value: `${kind}:${row.id}`, label: row.title || row.original_filename || "Untitled", kind: evidenceLabels[kind] }));
  }));
  return results.flat().slice(0, 24);
}
