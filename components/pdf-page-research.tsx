"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { createClient } from "@/lib/supabase/client";
import { finishPdfPage } from "@/app/(workspace)/library/items/media/pdf-page-actions";
import { maxPageImageBytes, pdfPageImagePath } from "@/lib/pdf-pages";

type BoardOption = { id: string; title: string };
export function PdfPageResearch({ documentId, documentTitle, ownerId, boards }: { documentId: string; documentTitle: string; ownerId: string; boards: BoardOption[] }) {
  const router = useRouter();
  const canvas = useRef<HTMLCanvasElement>(null);
  const pdf = useRef<PDFDocumentProxy | null>(null);
  const upload = useRef<{ page: number; id: string; uploaded: boolean } | null>(null);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [title, setTitle] = useState(`${documentTitle} · page 1`);
  const [note, setNote] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [boardId, setBoardId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof import("pdfjs-dist").getDocument> | undefined;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        task = pdfjs.getDocument({ url: `/library/items/media/${documentId}/pdf`, withCredentials: true });
        const document = await task.promise;
        if (cancelled) return;
        pdf.current = document;
        setCount(document.numPages);
        setLoading(false);
      } catch { if (!cancelled) { setError("The PDF could not be opened. Refresh or open the original file."); setLoading(false); } }
    })();
    return () => { cancelled = true; pdf.current = null; void task?.destroy(); };
  }, [documentId]);

  useEffect(() => {
    const document = pdf.current;
    const surface = canvas.current;
    if (!document || !surface || !count) return;
    let cancelled = false;
    let rendering: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const current = await document.getPage(page);
        if (cancelled) return;
        const raw = current.getViewport({ scale: 1 });
        const scale = Math.min(2, 1600 / Math.max(raw.width, raw.height));
        const viewport = current.getViewport({ scale });
        surface.width = Math.ceil(viewport.width);
        surface.height = Math.ceil(viewport.height);
        const context = surface.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas unavailable");
        context.fillStyle = "white";
        context.fillRect(0, 0, surface.width, surface.height);
        rendering = current.render({ canvas: surface, canvasContext: context, viewport });
        await rendering.promise;
        if (cancelled) return;
        const content = await current.getTextContent();
        if (cancelled) return;
        setExcerpt(content.items.filter((item): item is typeof item & { str: string } => "str" in item).map(item => item.str).join(" ").replace(/\s+/g, " ").slice(0, 5000));
        setLoading(false);
      } catch (cause) {
        if (!cancelled && !(cause instanceof Error && cause.name === "RenderingCancelledException")) { setError("This page could not be rendered."); setLoading(false); }
      }
    })();
    return () => { cancelled = true; rendering?.cancel(); };
  }, [page, count]);

  function changePage(next: number) {
    if (busy || next < 1 || next > count) return;
    setPage(next);
    setTitle(`${documentTitle} · page ${next}`);
    setNote("");
    setSaved("");
    upload.current = null;
  }

  async function savePage() {
    if (busy || loading || !canvas.current || !title.trim()) return;
    setBusy(true); setError(""); setSaved("");
    const job = upload.current?.page === page ? upload.current : { page, id: crypto.randomUUID(), uploaded: false };
    upload.current = job;
    try {
      if (!job.uploaded) {
        const image = await new Promise<Blob>((resolve, reject) => canvas.current!.toBlob(blob => blob ? resolve(blob) : reject(new Error("Page image unavailable.")), "image/png"));
        if (image.size > maxPageImageBytes) throw new Error("Rendered page exceeds 10 MB. Try another page.");
        const { error: uploadError } = await createClient().storage.from("research-media").upload(pdfPageImagePath(ownerId, documentId, job.id), image, { contentType: "image/png", upsert: false });
        if (uploadError) throw new Error("Page upload failed. Retry saving.");
        job.uploaded = true;
      }
      await finishPdfPage(documentId, job.id, page, title, note, excerpt);
      if (boardId) router.push(`/boards/${boardId}?add=media:${job.id}&transfer=${crypto.randomUUID()}`);
      else { setSaved(`Page ${page} saved to the Library.`); router.refresh(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save page."); }
    finally { setBusy(false); }
  }

  return <section className="panel pdf-research" aria-label="PDF page research">
    <div className="pdf-research-heading"><div><p className="panel-kicker">PDF page research</p><h2>Choose a page for your Board</h2><p>Review the page, add context, then save it as a linked visual source.</p></div><span>{count ? `${count} pages` : "Opening PDF…"}</span></div>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    {saved && <p className="notice notice-success" role="status">{saved}</p>}
    <div className="pdf-research-layout">
      <div className="pdf-preview"><div className="pdf-page-controls"><button type="button" disabled={busy || page <= 1} onClick={() => changePage(page - 1)}>← Previous</button><label>Page <input type="number" min={1} max={count || 1} value={page} disabled={busy || !count} onChange={event => changePage(Number(event.target.value))} /> of {count || "…"}</label><button type="button" disabled={busy || page >= count} onClick={() => changePage(page + 1)}>Next →</button></div><canvas ref={canvas} aria-label={`Preview of PDF page ${page}`} />{loading && <p>Rendering page…</p>}</div>
      <div className="form-stack pdf-research-fields"><label className="field"><span>Page title</span><input value={title} maxLength={200} onChange={event => setTitle(event.target.value)} /></label><label className="field"><span>Why this page matters</span><textarea value={note} maxLength={4000} rows={5} onChange={event => setNote(event.target.value)} placeholder="Record the detail, claim, image or question worth bringing onto a Board." /></label><details><summary>Extracted page text</summary><p className="pdf-page-text">{excerpt || "No selectable text was found. This may be a scanned page."}</p></details><label className="field"><span>Place on Board</span><select value={boardId} onChange={event => setBoardId(event.target.value)}><option value="">Save to Library only</option>{boards.map(board => <option key={board.id} value={board.id}>{board.title}</option>)}</select></label><button type="button" className="button button-primary" disabled={busy || loading || !count || !title.trim()} onClick={savePage}>{busy ? "Saving page…" : boardId ? "Save and place on Board" : "Save page to Library"}</button><small>Page image and number remain linked to this PDF. You can edit or delete the saved image in the Library.</small></div>
    </div>
  </section>;
}
