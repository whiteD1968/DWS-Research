"use server";

import sharp, { type Metadata } from "sharp";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { maxPageImageBytes, pdfPageImagePath, validPageNumber } from "@/lib/pdf-pages";

export async function finishPdfPage(documentId: string, imageId: string, page: number, title: string, note: string, pageText: string) {
  const user = await requireUser();
  const db = await createClient();
  const path = pdfPageImagePath(user.id, documentId, imageId);
  if (!validPageNumber(page) || typeof title !== "string" || !title.trim() || title.length > 200 || typeof note !== "string" || note.length > 4000 || typeof pageText !== "string" || pageText.length > 5000) throw new Error("Enter a valid page, title and note.");
  const { data: document, error: documentError } = await db.from("media").select("id,title,mime_type").eq("id", documentId).eq("owner_id", user.id).single();
  if (documentError || !document || document.mime_type !== "application/pdf") throw new Error("PDF source unavailable.");
  const { data: existing, error: existingError } = await db.from("media").select("id,storage_path,source_page,metadata").eq("id", imageId).eq("owner_id", user.id).maybeSingle();
  if (existingError) throw new Error("Could not check the saved page.");
  if (existing && (existing.storage_path !== path || existing.source_page !== page || existing.metadata?.source_document_id !== documentId)) throw new Error("Page identity conflict.");
  if (existing) {
    const { error: updateError } = await db.from("media").update({ title: title.trim(), caption: note.trim(), metadata: { ...existing.metadata, page_text: pageText.trim() } }).eq("id", imageId).eq("owner_id", user.id);
    if (updateError) throw new Error("Could not update the saved page. Retry.");
  } else {
    const { data: file, error: fileError } = await db.storage.from("research-media").download(path);
    if (fileError || !file || !file.size || file.size > maxPageImageBytes) throw new Error("Rendered page unavailable or too large. Retry upload.");
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("Rendered page is not a PNG.");
    let dimensions: Metadata;
    try { dimensions = await sharp(bytes, { limitInputPixels: 16000000 }).metadata(); }
    catch { throw new Error("Rendered page could not be read."); }
    if (dimensions.format !== "png" || !dimensions.width || !dimensions.height || dimensions.width > 4000 || dimensions.height > 4000) throw new Error("Rendered page dimensions are invalid.");
    const { error: saveError } = await db.from("media").upsert({ id: imageId, owner_id: user.id, media_type: "image", bucket: "research-media", storage_path: path, mime_type: "image/png", byte_size: file.size, width: dimensions.width, height: dimensions.height, title: title.trim(), original_filename: `${document.title || "Document"} - page ${page}.png`, source_page: page, caption: note.trim(), alt_text: `Page ${page} of ${document.title || "PDF document"}`, metadata: { source_document_id: documentId, origin: "pdf_page", page_text: pageText.trim() } }, { onConflict: "id", ignoreDuplicates: true });
    if (saveError) throw new Error("Page image uploaded, but its source record could not be saved. Retry.");
  }
  const { error: linkError } = await db.from("relationships").upsert({ owner_id: user.id, source_type: "media", source_id: imageId, relationship_type: "derived_from", target_type: "media", target_id: documentId, metadata: { page } }, { onConflict: "source_type,source_id,relationship_type,target_type,target_id", ignoreDuplicates: true });
  if (linkError) throw new Error("Page saved, but its PDF link failed. Retry.");
  revalidatePath(`/library/items/media/${documentId}`);
  revalidatePath(`/library/items/media/${imageId}`);
  revalidatePath("/library");
  return { id: imageId };
}
