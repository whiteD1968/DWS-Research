"use server";
import { revalidatePath } from "next/cache";
import { getFormValue, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { allowedImageTypes, buildStoragePath, createMediaFromFile } from "@/lib/media-upload";
import { journalParent, maxJournalImages, parseEntryDate, parseJournalLink } from "@/lib/journal";
import { parseRemindAt } from "@/lib/reminders";

const files = (form: FormData, key: string) => form.getAll(key).filter((item): item is File => item instanceof File && item.size > 0);

export async function createJournalEntry(form: FormData) {
  const user = await requireUser();
  const text = getFormValue(form, "text") ?? ""; const title = getFormValue(form, "title");
  const day = parseEntryDate(form.get("entry_date"), new Date().toISOString().slice(0, 10));
  const link = parseJournalLink(form.get("link"));
  const sketches = files(form, "sketches"); const photos = files(form, "photos");
  const images = [...sketches.map(file => ({ file, sketch: true })), ...photos.map(file => ({ file, sketch: false }))];
  const remindAt = parseRemindAt(form.get("remind_at"));
  if (!text && !images.length) throw new Error("Write something or add a sketch first.");
  if (remindAt && !text && !title) throw new Error("Add a few words so the reminder says what to do.");
  if (text.length > 50000 || (title?.length ?? 0) > 200) throw new Error("This entry is too long to save.");
  if (images.length > maxJournalImages) throw new Error(`Add up to ${maxJournalImages} images per entry.`);
  if (images.some(({ file }) => !allowedImageTypes.has(file.type) || file.size > 8 * 1024 * 1024)) throw new Error("Images must be JPEG, PNG, or WebP and under 8 MB.");

  const db = await createClient();
  if (link) {
    const { data } = await db.from(link.kind === "project" ? "projects" : "research_threads").select("id").eq("owner_id", user.id).eq("id", link.id).maybeSingle();
    if (!data) throw new Error("That project or topic is unavailable. Refresh and try again.");
  }
  const { data: note, error } = await db.from("notes").insert({ owner_id: user.id, title, plain_text: text, parent_type: journalParent, content: [], metadata: { entry_date: day, ...(remindAt ? { remind_at: remindAt } : {}) } }).select("id").single();
  if (error || !note) throw new Error("Could not save this entry. Please retry.");

  // Images become ordinary library media, tagged so they can be found again from the Library filters.
  const tagIds: Record<string, string> = {};
  for (const name of ["journal", ...(sketches.length ? ["sketch"] : [])]) {
    const { data: tag } = await db.from("tags").upsert({ owner_id: user.id, name }, { onConflict: "owner_id,name" }).select("id").single();
    if (tag) tagIds[name] = tag.id;
  }
  const links: Record<string, unknown>[] = []; const tags: Record<string, unknown>[] = [];
  for (const [index, { file, sketch }] of images.entries()) {
    const mediaId = await createMediaFromFile({ ownerId: user.id, file, storagePath: buildStoragePath({ ownerId: user.id, recordType: "journal", recordId: note.id, fileName: file.name }), title: title || `${sketch ? "Sketch" : "Journal photo"}, ${day}` });
    links.push({ owner_id: user.id, source_type: "note", source_id: note.id, relationship_type: "has_media", target_type: "media", target_id: mediaId, metadata: { sort_order: index } });
    if (link) links.push({ owner_id: user.id, source_type: link.kind, source_id: link.id, relationship_type: "has_media", target_type: "media", target_id: mediaId, metadata: {} });
    for (const name of sketch ? ["journal", "sketch"] : ["journal"]) if (tagIds[name]) tags.push({ owner_id: user.id, record_type: "media", record_id: mediaId, tag_id: tagIds[name] });
  }
  if (link) links.push({ owner_id: user.id, source_type: link.kind, source_id: link.id, relationship_type: "has_note", target_type: "note", target_id: note.id, metadata: {} });
  const onConflict = "source_type,source_id,relationship_type,target_type,target_id";
  const saved = await Promise.all([
    links.length ? db.from("relationships").upsert(links, { onConflict, ignoreDuplicates: true }) : { error: null },
    tags.length ? db.from("record_tags").upsert(tags, { onConflict: "record_type,record_id,tag_id", ignoreDuplicates: true }) : { error: null },
  ]);
  if (saved.some(result => result.error)) throw new Error("The entry saved, but some images could not be linked. Open it from the Library to finish.");
  revalidatePath("/journal"); revalidatePath("/library");
  return note.id as string;
}

export async function journalLinkOptions() {
  const user = await requireUser(); const db = await createClient();
  const [projects, topics] = await Promise.all([
    db.from("projects").select("id,title").eq("owner_id", user.id).order("title").limit(300),
    db.from("research_threads").select("id,title").eq("owner_id", user.id).order("title").limit(300),
  ]);
  return [
    { label: "Projects", options: (projects.data || []).map(row => ({ value: `project:${row.id}`, label: row.title || "Untitled" })) },
    { label: "Research topics", options: (topics.data || []).map(row => ({ value: `research_thread:${row.id}`, label: row.title || "Untitled" })) },
  ];
}

// Reminder changes merge into the note's metadata so its journal day and other details are kept.
async function updateReminder(id: string, change: (meta: Record<string, unknown>) => Record<string, unknown>) {
  const user = await requireUser(); const db = await createClient();
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("That reminder is unavailable.");
  const { data: note } = await db.from("notes").select("metadata").eq("owner_id", user.id).eq("id", id).maybeSingle();
  if (!note) throw new Error("That reminder is unavailable. Refresh and try again.");
  const { error } = await db.from("notes").update({ metadata: change({ ...(note.metadata as Record<string, unknown> || {}) }) }).eq("owner_id", user.id).eq("id", id);
  if (error) throw new Error("Could not update the reminder. Please retry.");
  revalidatePath("/", "layout");
}

export async function completeReminder(id: string, done = true) {
  await updateReminder(id, meta => { if (done) meta.done_at = new Date().toISOString(); else delete meta.done_at; return meta; });
}

export async function rescheduleReminder(id: string, remindAt: string | null) {
  const next = remindAt === null ? null : parseRemindAt(remindAt);
  if (remindAt !== null && !next) throw new Error("Choose a valid time.");
  await updateReminder(id, meta => { if (next) { meta.remind_at = next; delete meta.done_at; } else { delete meta.remind_at; delete meta.done_at; } return meta; });
}
