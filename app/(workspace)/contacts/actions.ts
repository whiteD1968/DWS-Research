"use server";
import { revalidatePath } from "next/cache";
import { getFormValue, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { studioToday } from "@/lib/journal";
import { recordRoutes } from "@/lib/records";
import { parseEvidence } from "@/lib/dossier";
import { nineAmEastern } from "@/lib/opportunities";
import { contactLinkType, contactParent, normalizeWebsite, parseDay, parseRole, type Touch } from "@/lib/contacts";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const field = (form: FormData, key: string, max: number) => (getFormValue(form, key) ?? "").slice(0, max);
function done() { revalidatePath("/contacts"); revalidatePath("/", "layout"); }

async function owned(id: string) {
  if (typeof id !== "string" || !uuid.test(id)) throw new Error("That contact is unavailable.");
  const user = await requireUser(); const db = await createClient();
  const { data } = await db.from("notes").select("id,metadata").eq("owner_id", user.id).eq("parent_type", contactParent).eq("id", id).maybeSingle();
  if (!data) throw new Error("That contact is unavailable. Refresh and try again.");
  return { user, db, meta: (data.metadata || {}) as Record<string, unknown> };
}

// A follow-up date doubles as the note's reminder, so it appears on Home at 9am that day.
function withFollowUp(meta: Record<string, unknown>, day: string) {
  const next: Record<string, unknown> = { ...meta, follow_up: day || null };
  if (day) { next.remind_at = nineAmEastern(day); delete next.done_at; } else { delete next.remind_at; delete next.done_at; }
  return next;
}

export async function saveContact(form: FormData) {
  const user = await requireUser(); const db = await createClient();
  const id = getFormValue(form, "id");
  const name = field(form, "name", 200);
  if (!name) throw new Error("Add a name.");
  const email = field(form, "email", 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("That email address doesn't look right.");
  const website = normalizeWebsite(field(form, "website", 300));
  if (website === null) throw new Error("That website doesn't look right.");
  const followUp = parseDay(form.get("follow_up") ?? "");
  if (followUp === null) throw new Error("Choose a valid follow-up date.");
  const fields = { role: parseRole(form.get("role")), organization: field(form, "organization", 200), email, phone: field(form, "phone", 60), website, instagram: field(form, "instagram", 60).replace(/^@/, ""), city: field(form, "city", 120), how_met: field(form, "how_met", 300) };
  const notes = field(form, "notes", 20000);
  if (id) {
    const { meta } = await owned(id);
    const { error } = await db.from("notes").update({ title: name, plain_text: notes, metadata: withFollowUp({ ...meta, ...fields }, followUp) }).eq("owner_id", user.id).eq("id", id);
    if (error) throw new Error("Could not save. Please retry.");
    done(); return id;
  }
  const firstTouch = field(form, "first_touch", 300);
  const log: Touch[] = firstTouch ? [{ date: studioToday(), text: firstTouch }] : [];
  const { data, error } = await db.from("notes").insert({ owner_id: user.id, title: name, plain_text: notes, parent_type: contactParent, content: [], metadata: withFollowUp({ ...fields, log }, followUp) }).select("id").single();
  if (error || !data) throw new Error("Could not save. Please retry.");
  done(); return data.id as string;
}

export async function logTouch(id: string, date: string, text: string) {
  const day = parseDay(date); const note = typeof text === "string" ? text.trim().slice(0, 500) : "";
  if (!day) throw new Error("Choose a date.");
  if (!note) throw new Error("Add a few words about it.");
  const { user, db, meta } = await owned(id);
  const log = [{ date: day, text: note }, ...(Array.isArray(meta.log) ? meta.log : [])].slice(0, 300);
  // Logging a touchpoint on or after the follow-up date counts as following up.
  const followUp = typeof meta.follow_up === "string" && meta.follow_up <= day ? "" : String(meta.follow_up || "");
  const { error } = await db.from("notes").update({ metadata: withFollowUp({ ...meta, log }, followUp) }).eq("owner_id", user.id).eq("id", id);
  if (error) throw new Error("Could not log that. Please retry.");
  done();
}

export async function removeTouch(id: string, touch: Touch) {
  const { user, db, meta } = await owned(id);
  const log = Array.isArray(meta.log) ? [...meta.log] : [];
  const index = log.findIndex(item => item && (item as Touch).date === touch?.date && (item as Touch).text === touch?.text);
  if (index < 0) return;
  log.splice(index, 1);
  const { error } = await db.from("notes").update({ metadata: { ...meta, log } }).eq("owner_id", user.id).eq("id", id);
  if (error) throw new Error("Could not remove that. Please retry.");
  done();
}

export async function setFollowUp(id: string, date: string) {
  const day = parseDay(date);
  if (day === null) throw new Error("Choose a valid date.");
  const { user, db, meta } = await owned(id);
  const { error } = await db.from("notes").update({ metadata: withFollowUp(meta, day) }).eq("owner_id", user.id).eq("id", id);
  if (error) throw new Error("Could not set the follow-up. Please retry.");
  done();
}

export async function linkContact(id: string, value: string) {
  const target = parseEvidence(value);
  if (!target) throw new Error("Choose something to connect.");
  const { user, db } = await owned(id);
  if (target.kind === "note" && target.id === id) throw new Error("A contact can't be linked to itself.");
  const { data } = await db.from(recordRoutes[target.kind].table).select("id").eq("owner_id", user.id).eq("id", target.id).maybeSingle();
  if (!data) throw new Error("That item is unavailable.");
  const { error } = await db.from("relationships").upsert({ owner_id: user.id, source_type: "note", source_id: id, relationship_type: contactLinkType, target_type: target.kind, target_id: target.id, metadata: {} }, { onConflict: "source_type,source_id,relationship_type,target_type,target_id", ignoreDuplicates: true });
  if (error) throw new Error("Could not connect that. Please retry.");
  revalidatePath("/contacts");
}

export async function unlinkContact(relationshipId: string) {
  if (!uuid.test(relationshipId)) throw new Error("That link is unavailable.");
  const user = await requireUser(); const db = await createClient();
  const { error } = await db.from("relationships").delete().eq("owner_id", user.id).eq("id", relationshipId).eq("relationship_type", contactLinkType);
  if (error) throw new Error("Could not remove that link.");
  revalidatePath("/contacts");
}
