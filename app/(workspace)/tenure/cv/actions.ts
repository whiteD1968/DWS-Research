"use server";
import { revalidatePath } from "next/cache";
import { getFormValue, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { allowedImageTypes, buildStoragePath, createMediaFromFile } from "@/lib/media-upload";
import { pdfTitle, pdfValidation } from "@/lib/topic-pdf";
import { cvCategory, cvParent, parseCvCategory, parseCvDate } from "@/lib/cv";
import { evidenceRow, sectionNoteId } from "@/lib/dossier-server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const onConflict = "source_type,source_id,relationship_type,target_type,target_id";
const field = (form: FormData, key: string, max: number) => { const value = (getFormValue(form, key) ?? "").slice(0, max); return value; };

function done() { revalidatePath("/tenure/cv"); revalidatePath("/tenure"); revalidatePath("/library"); }

async function ownedEntry(id: string) {
  if (!uuid.test(id)) throw new Error("That entry is unavailable.");
  const user = await requireUser(); const db = await createClient();
  const { data } = await db.from("notes").select("id,metadata").eq("owner_id", user.id).eq("parent_type", cvParent).eq("id", id).maybeSingle();
  if (!data) throw new Error("That entry is unavailable. Refresh and try again.");
  return { user, db, entry: data };
}

// One action for new and edited entries; images ride along, PDFs upload straight to storage afterwards.
export async function saveCvEntry(form: FormData) {
  const user = await requireUser(); const db = await createClient();
  const id = getFormValue(form, "id");
  const category = parseCvCategory(form.get("category"));
  const title = field(form, "title", 300);
  const date = parseCvDate(form.get("year"), form.get("month"));
  const endYear = getFormValue(form, "end_year");
  const endDate = endYear ? parseCvDate(endYear) : "";
  if (!category) throw new Error("Choose what kind of entry this is.");
  if (!title) throw new Error("Add a title.");
  if (!date) throw new Error("Enter the year, between 1950 and 2100.");
  if (endDate === null || (endDate && endDate < date.slice(0, 4))) throw new Error("The end year must come after the start.");
  const url = field(form, "url", 500);
  if (url && !/^https?:\/\//i.test(url)) throw new Error("Links should start with http:// or https://.");
  const images = form.getAll("images").filter((item): item is File => item instanceof File && item.size > 0);
  if (images.length > 6) throw new Error("Add up to 6 images at a time.");
  if (images.some(file => !allowedImageTypes.has(file.type) || file.size > 8 * 1024 * 1024)) throw new Error("Images must be JPEG, PNG, or WebP and under 8 MB.");
  const metadata = { category, venue: field(form, "venue", 300), location: field(form, "location", 200), date, end_date: endDate || "", people: field(form, "people", 300), url };
  const notes = field(form, "notes", 20000);

  let entryId: string;
  if (id) {
    const { entry } = await ownedEntry(id);
    const merged = { ...((entry.metadata as Record<string, unknown>) || {}), ...metadata };
    const { error } = await db.from("notes").update({ title, plain_text: notes, metadata: merged }).eq("owner_id", user.id).eq("id", id);
    if (error) throw new Error("Could not save this entry. Please retry.");
    entryId = id;
  } else {
    const { data, error } = await db.from("notes").insert({ owner_id: user.id, title, plain_text: notes, parent_type: cvParent, content: [], metadata }).select("id").single();
    if (error || !data) throw new Error("Could not save this entry. Please retry.");
    entryId = data.id;
  }

  const links: Record<string, unknown>[] = [];
  for (const file of images) {
    const mediaId = await createMediaFromFile({ ownerId: user.id, file, storagePath: buildStoragePath({ ownerId: user.id, recordType: "cv", recordId: entryId, fileName: file.name }), title });
    links.push({ owner_id: user.id, source_type: "note", source_id: entryId, relationship_type: "has_media", target_type: "media", target_id: mediaId, metadata: {} });
  }
  // New entries are filed into the dossier section their category belongs to, unless you opt out.
  if (!id && form.get("dossier") !== "off") links.push(evidenceRow(user.id, await sectionNoteId(db, user.id, cvCategory(category).section), "note", entryId));
  if (links.length) {
    const { error } = await db.from("relationships").upsert(links, { onConflict, ignoreDuplicates: true });
    if (error) throw new Error("The entry saved, but its files could not be linked. Open it from the Library to finish.");
  }
  done();
  return entryId;
}

const cvPdfPath = (owner: string, entry: string, upload: string, name: string) => `${owner}/cv/${entry}/${upload}-${name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-180) || "document.pdf"}`;

export async function prepareCvPdf(entryId: string, uploadId: string, filename: string) {
  if (!uuid.test(uploadId)) throw new Error("Invalid upload.");
  const { user } = await ownedEntry(entryId);
  return cvPdfPath(user.id, entryId, uploadId, filename);
}

export async function finishCvPdf(entryId: string, uploadId: string, filename: string) {
  if (!uuid.test(uploadId)) throw new Error("Invalid upload.");
  const { user, db } = await ownedEntry(entryId);
  const path = cvPdfPath(user.id, entryId, uploadId, filename);
  const { data: existing } = await db.from("media").select("id,storage_path").eq("owner_id", user.id).eq("id", uploadId).maybeSingle();
  if (existing && existing.storage_path !== path) throw new Error("Upload identity conflict.");
  if (!existing) {
    const { data: file, error } = await db.storage.from("research-documents").download(path);
    if (error || !file) throw new Error("The PDF didn't finish uploading. Please retry.");
    const invalid = pdfValidation(file.type.split(";")[0], file.size);
    if (invalid) throw new Error(invalid);
    if (!(await file.slice(0, 5).text()).startsWith("%PDF-")) throw new Error("That file is not a valid PDF.");
    const { error: mediaError } = await db.from("media").upsert({ id: uploadId, owner_id: user.id, media_type: "document", bucket: "research-documents", storage_path: path, original_filename: filename, mime_type: "application/pdf", byte_size: file.size, title: pdfTitle(filename), metadata: {} }, { onConflict: "id", ignoreDuplicates: true });
    if (mediaError) throw new Error("The PDF uploaded, but could not be saved. Please retry.");
  }
  const { error } = await db.from("relationships").upsert({ owner_id: user.id, source_type: "note", source_id: entryId, relationship_type: "has_document", target_type: "media", target_id: uploadId, metadata: {} }, { onConflict, ignoreDuplicates: true });
  if (error) throw new Error("The PDF saved, but could not be attached. Please retry.");
  done();
}
