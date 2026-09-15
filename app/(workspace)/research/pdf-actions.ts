"use server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pdfPath, pdfTitle, pdfValidation } from "@/lib/topic-pdf";
import { revalidatePath } from "next/cache";

async function uploadContext(topicId: string, uploadId: string, filename: string) {
  const user = await requireUser();
  const db = await createClient();
  const path = pdfPath(user.id, topicId, uploadId, filename);
  const { data, error } = await db.from("research_threads").select("id").eq("id", topicId).eq("owner_id", user.id).single();
  if (error || !data) throw new Error("Research Topic unavailable.");
  return { db, user, path };
}
export async function prepareTopicPdf(topicId: string, uploadId: string, filename: string) {
  try { const { path } = await uploadContext(topicId, uploadId, filename); return { path }; }
  catch (error) { return { error: error instanceof Error ? error.message : "Unable to prepare upload." }; }
}
export async function finishTopicPdf(topicId: string, uploadId: string, filename: string, title: string) {
  try {
    const { db, user, path } = await uploadContext(topicId, uploadId, filename);
    const { data: existing, error: existingError } = await db.from("media").select("id,storage_path,bucket").eq("id", uploadId).eq("owner_id", user.id).maybeSingle();
    if (existingError) throw new Error("Unable to check the document record.");
    if (existing && (existing.storage_path !== path || existing.bucket !== "research-documents")) throw new Error("Upload identity conflict.");
    if (!existing) {
      const { data: file, error } = await db.storage.from("research-documents").download(path);
      if (error || !file) throw new Error("Uploaded file is unavailable. Retry the upload.");
      const invalid = pdfValidation(file.type.split(";")[0], file.size);
      if (invalid) throw new Error(invalid);
      if (!(await file.slice(0, 5).text()).startsWith("%PDF-")) throw new Error("The file does not contain a valid PDF header.");
      const { error: mediaError } = await db.from("media").upsert({ id: uploadId, owner_id: user.id, media_type: "document", bucket: "research-documents", storage_path: path, original_filename: filename, mime_type: "application/pdf", byte_size: file.size, title: title.trim().slice(0, 200) || pdfTitle(filename), metadata: {} }, { onConflict: "id", ignoreDuplicates: true });
      if (mediaError) throw new Error("File uploaded, but the document record could not be saved. Retry to finish.");
    }
    const { error } = await db.from("relationships").upsert({ owner_id: user.id, source_type: "research_thread", source_id: topicId, relationship_type: "has_document", target_type: "media", target_id: uploadId }, { onConflict: "source_type,source_id,relationship_type,target_type,target_id", ignoreDuplicates: true });
    if (error) throw new Error("Document saved, but topic linking failed. Retry to finish linking.");
    await db.from("research_threads").update({ updated_at: new Date().toISOString() }).eq("id", topicId).eq("owner_id", user.id);
    revalidatePath(`/research/${topicId}`); revalidatePath("/research"); revalidatePath("/library");
    return { id: uploadId };
  } catch (error) { return { error: error instanceof Error ? error.message : "Unable to save document." }; }
}
