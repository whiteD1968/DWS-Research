"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { prepareTopicPdf, finishTopicPdf } from "@/app/(workspace)/research/pdf-actions";
import { documentBytes, pdfTitle, pdfValidation } from "@/lib/topic-pdf";

type Upload = { id: string; file: File; title: string; uploaded: boolean; phase: "staged" | "uploading" | "saving" | "saved" | "error"; error?: string };
export function TopicPdfUpload({ topicId }: { topicId: string }) {
  const [files, setFiles] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const patch = (id: string, values: Partial<Upload>) => setFiles(items => items.map(item => item.id === id ? { ...item, ...values } : item));
  function stage(list: FileList | null) {
    if (!list || busy) return;
    setFiles(items => [...items, ...Array.from(list).map(file => ({ id: crypto.randomUUID(), file, title: pdfTitle(file.name), uploaded: false, phase: "staged" as const, error: pdfValidation(file.type, file.size) ?? undefined }))]);
    if (input.current) input.current.value = "";
  }
  async function upload() {
    setBusy(true);
    let saved = false;
    try {
      for (const item of files.filter(item => item.phase !== "saved" && !pdfValidation(item.file.type, item.file.size))) {
        try {
          const prepared = await prepareTopicPdf(topicId, item.id, item.file.name);
          if (!prepared.path) throw new Error(prepared.error);
          if (!item.uploaded) {
            if (!(await item.file.slice(0, 5).text()).startsWith("%PDF-")) throw new Error("This file is not a PDF.");
            patch(item.id, { phase: "uploading", error: undefined });
            const db = createClient();
            const { error } = await db.storage.from("research-documents").upload(prepared.path, item.file, { contentType: "application/pdf", upsert: false });
            // A previous attempt may have uploaded successfully before losing its response.
            if (error && !("statusCode" in error && String(error.statusCode) === "409")) throw new Error(error.message);
            patch(item.id, { uploaded: true });
          }
          patch(item.id, { phase: "saving", error: undefined });
          const result = await finishTopicPdf(topicId, item.id, item.file.name, item.title);
          if (result.error) throw new Error(result.error);
          patch(item.id, { phase: "saved" }); saved = true;
        } catch (error) { patch(item.id, { phase: "error", error: error instanceof Error ? error.message : "Upload failed. Retry." }); }
      }
    } finally { setBusy(false); if (saved) router.refresh(); }
  }
  return <details className="research-add topic-pdf-upload"><summary>+ Upload PDF</summary>
    <label className={dragging ? "drop-field drop-field-active" : "drop-field"} onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); stage(event.dataTransfer.files); }}>
      <span>Drop PDFs or choose files</span><input ref={input} type="file" accept="application/pdf" multiple disabled={busy} onChange={event => stage(event.target.files)} />
    </label>
    <div aria-live="polite">{files.map(item => <div key={item.id} className="topic-pdf-staged"><div><strong>{item.file.name}</strong><small>{documentBytes(item.file.size)} &middot; {item.phase}</small></div>
      <label>Title<input value={item.title} maxLength={200} disabled={busy || item.phase === "saved"} onChange={event => patch(item.id, { title: event.target.value })} /></label>
      {(item.phase === "uploading" || item.phase === "saving") && <progress aria-label={`${item.file.name}: ${item.phase}`} />}
      {item.error && <p role="alert">{item.error}</p>}<button type="button" className="text-button" disabled={busy} onClick={() => setFiles(items => items.filter(file => file.id !== item.id))}>Dismiss</button>
    </div>)}</div>
    <button type="button" className="button" disabled={busy || !files.some(item => item.phase !== "saved" && !pdfValidation(item.file.type, item.file.size))} onClick={upload}>{busy ? "Uploading..." : "Upload / retry PDFs"}</button>
  </details>;
}
