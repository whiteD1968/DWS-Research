"use server";
import { revalidatePath } from "next/cache";
import { getFormValue, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { studioToday } from "@/lib/journal";
import { defaultMaterials, opportunityParent, parseDeadline, parseOpportunityKind, parseStatus, reminderFor, stageOf, type Material, type OpportunityStatus } from "@/lib/opportunities";
import { cvParent } from "@/lib/cv";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const field = (form: FormData, key: string, max: number) => (getFormValue(form, key) ?? "").slice(0, max);
function done() { revalidatePath("/opportunities"); revalidatePath("/", "layout"); }

async function owned(id: string) {
  if (typeof id !== "string" || !uuid.test(id)) throw new Error("That opportunity is unavailable.");
  const user = await requireUser(); const db = await createClient();
  const { data } = await db.from("notes").select("id,metadata").eq("owner_id", user.id).eq("parent_type", opportunityParent).eq("id", id).maybeSingle();
  if (!data) throw new Error("That opportunity is unavailable. Refresh and try again.");
  return { user, db, meta: (data.metadata || {}) as Record<string, unknown> };
}

// Open opportunities carry a reminder ahead of the deadline; once submitted or decided, the reminder is cleared.
function withReminder(meta: Record<string, unknown>) {
  const status = (parseStatus(meta.status) ?? "interested") as OpportunityStatus;
  const remindAt = stageOf(status) === "interested" || stageOf(status) === "preparing" ? reminderFor(String(meta.deadline || ""), studioToday()) : null;
  const next = { ...meta };
  if (remindAt) { next.remind_at = remindAt; delete next.done_at; } else { delete next.remind_at; delete next.done_at; }
  return next;
}

export async function saveOpportunity(form: FormData) {
  const user = await requireUser(); const db = await createClient();
  const id = getFormValue(form, "id");
  const title = field(form, "title", 300);
  const kind = parseOpportunityKind(form.get("kind"));
  const deadline = parseDeadline(form.get("deadline") ?? "");
  const url = field(form, "url", 500);
  if (!title) throw new Error("Add a name for this opportunity.");
  if (!kind) throw new Error("Choose what kind of opportunity this is.");
  if (deadline === null) throw new Error("Choose a valid deadline.");
  if (url && !/^https?:\/\//i.test(url)) throw new Error("Links should start with http:// or https://.");
  const fields = { kind, organization: field(form, "organization", 300), location: field(form, "location", 200), deadline, url, fee: field(form, "fee", 40), award: field(form, "award", 80) };
  const notes = field(form, "notes", 20000);
  if (id) {
    const { meta } = await owned(id);
    const { error } = await db.from("notes").update({ title, plain_text: notes, metadata: withReminder({ ...meta, ...fields }) }).eq("owner_id", user.id).eq("id", id);
    if (error) throw new Error("Could not save. Please retry.");
  } else {
    const status = parseStatus(form.get("status")) ?? "interested";
    const { error } = await db.from("notes").insert({ owner_id: user.id, title, plain_text: notes, parent_type: opportunityParent, content: [], metadata: withReminder({ ...fields, status, materials: defaultMaterials(kind) }) });
    if (error) throw new Error("Could not save. Please retry.");
  }
  done();
}

export async function setOpportunityStatus(id: string, status: string) {
  const next = parseStatus(status);
  if (!next) throw new Error("Choose a stage.");
  const { user, db, meta } = await owned(id);
  const decided = stageOf(next) === "decided";
  const updated = withReminder({ ...meta, status: next, decided_at: decided ? (meta.decided_at || studioToday()) : null, submitted_at: next === "submitted" ? (meta.submitted_at || studioToday()) : meta.submitted_at ?? null });
  const { error } = await db.from("notes").update({ metadata: updated }).eq("owner_id", user.id).eq("id", id);
  if (error) throw new Error("Could not update. Please retry.");
  done();
}

export async function setOpportunityMaterials(id: string, materials: Material[]) {
  if (!Array.isArray(materials) || materials.length > 30) throw new Error("Keep the checklist to 30 items.");
  const clean = materials.map(item => ({ label: String(item?.label ?? "").trim().slice(0, 120), done: Boolean(item?.done) })).filter(item => item.label);
  const { user, db, meta } = await owned(id);
  const { error } = await db.from("notes").update({ metadata: { ...meta, materials: clean } }).eq("owner_id", user.id).eq("id", id);
  if (error) throw new Error("Could not save the checklist. Please retry.");
  revalidatePath("/opportunities");
}

// After an acceptance is logged to the CV, the opportunity remembers which entry it became.
export async function linkOpportunityCv(id: string, cvEntryId: string) {
  if (!uuid.test(cvEntryId)) throw new Error("That CV entry is unavailable.");
  const { user, db, meta } = await owned(id);
  const { data } = await db.from("notes").select("id").eq("owner_id", user.id).eq("parent_type", cvParent).eq("id", cvEntryId).maybeSingle();
  if (!data) throw new Error("That CV entry is unavailable.");
  const { error } = await db.from("notes").update({ metadata: { ...meta, cv_entry_id: cvEntryId } }).eq("owner_id", user.id).eq("id", id);
  if (error) throw new Error("Could not link the CV entry.");
  revalidatePath("/opportunities");
}
