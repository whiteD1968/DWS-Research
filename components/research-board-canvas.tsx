"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated, server-resized thumbnail endpoint. */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BaseBoxShapeUtil, HTMLContainer, T, Tldraw, getSnapshot, DefaultColorStyle, DefaultFontStyle, defaultHandleExternalTldrawContent, renderPlaintextFromRichText, type Editor, type TLRichText } from "tldraw";
import "tldraw/tldraw.css";
import { saveBoard, renameBoard, convertBoardText, finishBoardImage } from "@/app/(workspace)/boards/actions";
import { createClient } from "@/lib/supabase/client";
import type { BoardRecord, Composition } from "@/lib/boards/layout";

import { initializeResearchBoard, insertResearchRecord, type RecordShape } from "@/lib/boards/insertion";
const Records = createContext<BoardRecord[]>([]);
function RecordCard({ shape }: { shape: RecordShape }) {
  const record = useContext(Records).find(r => r.key === shape.props.recordKey);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  return <HTMLContainer className="research-board-card" style={{ width: shape.props.w, height: shape.props.h }}>
    {record?.image && failedImage !== record.image && <img src={record.image} alt="" loading="lazy" draggable={false} onError={() => setFailedImage(record.image!)} />}
    <div><small>{record?.type || "Unavailable record"}</small><strong>{record?.title || "Source removed"}</strong><p>{record?.subtitle}</p></div>
  </HTMLContainer>;
}
class ResearchRecordUtil extends BaseBoxShapeUtil<RecordShape> {
  static override type = "research-record" as const;
  static override props = { w: T.number, h: T.number, recordKey: T.string, recordType: T.string.optional(), recordId: T.string.optional(), title: T.string.optional(), subtitle: T.string.optional(), image: T.string.optional() };
  getDefaultProps() { return { w: 280, h: 300, recordKey: "" }; }
  override canEdit() { return false; }
  component(shape: RecordShape) { return <RecordCard shape={shape} />; }
  getIndicatorPath(shape: RecordShape) { const path = new Path2D(); path.rect(0, 0, shape.props.w, shape.props.h); return path; }
}
const shapeUtils = [ResearchRecordUtil];
const components = { StylePanel: null };
type ImageJob = { id: string; file: File; point?: { x: number; y: number }; uploaded: boolean };
export type BoardCanvasProps = { board: { id: string; title: string; description: string | null; research_thread_id: string | null; updated_at: string; snapshot: unknown; metadata: { composition?: Composition } }; records: BoardRecord[]; ownerId: string };

export function ResearchBoardCanvas({ board, records: initialRecords, ownerId, persist = saveBoard }: BoardCanvasProps & { persist?: typeof saveBoard }) {
  const [records, setRecords] = useState(initialRecords);
  const [status, setStatus] = useState("Saved");
  const [error, setError] = useState("");
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description || "");
  const [details, setDetails] = useState(false);
  const [conversion, setConversion] = useState<{ id: string; shapeId: string; type: "note" | "reference"; text: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failedImages, setFailedImages] = useState<ImageJob[]>([]);
  const editor = useRef<Editor | null>(null);
  const [ready, setReady] = useState(false);
  const [licenseError, setLicenseError] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const queueSave = useRef<(() => void) | null>(null);
  const revision = useRef(board.updated_at);
  const pending = useRef<unknown>(null);
  const running = useRef(false);
  const stopped = useRef(false);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    // tldraw 5.4.2 renders this gate instead of its editor when licensing fails.
    // Observe the rendered outcome without accessing private SDK state or bypassing it.
    const observer = new MutationObserver(() => {
      setLicenseError(!!surface.querySelector('[data-testid="tl-license-expired"]'));
    });
    observer.observe(surface, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  async function flush() {
    if (running.current || stopped.current || !pending.current) return;
    running.current = true; setStatus("Saving...");
    const snapshot = pending.current; pending.current = null;
    try {
      revision.current = await persist(board.id, revision.current, snapshot);
      setStatus("Saved"); setError("");
    } catch (e) {
      pending.current ||= snapshot; stopped.current = true; setStatus("Error saving");
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally { running.current = false; }
    if (pending.current && !stopped.current) void flush();
  }
  function place(record: BoardRecord, position?: { x: number; y: number }) {
    const ed = editor.current;
    if (!ed) { setError("The board is still loading. Try again shortly."); return false; }
    try {
      ed.markHistoryStoppingPoint("Add research record");
      insertResearchRecord(ed, record, position);
      queueSave.current?.();
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to add record."); return false; }
  }

  function convert(type: "note" | "reference") {
    const ed = editor.current;
    const shape = ed?.getOnlySelectedShape();
    if (!ed || !shape || !["text", "note"].includes(shape.type) || !("richText" in shape.props)) { setError("Select one text or sticky note."); return; }
    const text = renderPlaintextFromRichText(ed, shape.props.richText as TLRichText);
    setConversion({ id: crypto.randomUUID(), shapeId: shape.id, type, text, title: text.slice(0, 100) });
  }
  async function uploadImage(job: ImageJob) {
    try {
      const extension = job.file.type.split("/")[1];
      if (!job.uploaded) {
        const db = createClient();
        const path = `${ownerId}/boards/${board.id}/${job.id}.${extension}`;
        const { error } = await db.storage.from("research-media").upload(path, job.file, { contentType: job.file.type, upsert: true });
        if (error) throw new Error("Image upload failed.");
        job.uploaded = true;
      }
      const record = await finishBoardImage(board.id, job.id, extension, job.file.name);
      setRecords(prev => [...prev.filter(r => r.key !== record.key), record]);
      if (!place(record, job.point)) throw new Error("Image saved, but placement failed. Retry when the editor is available.");
      setFailedImages(prev => prev.filter(j => j.id !== job.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed.");
      setFailedImages(prev => [...prev.filter(j => j.id !== job.id), job]);
    }
  }
  function mount(ed: Editor) {
    editor.current = ed;
    try {
      initializeResearchBoard(ed, board.snapshot, board.metadata?.composition, initialRecords);
      ed.setStyleForNextShapes(DefaultColorStyle, "black");
      ed.setStyleForNextShapes(DefaultFontStyle, "sans");
      setReady(true);
    } catch { setError("This board could not be loaded. No changes will be saved."); stopped.current = true; ed.updateInstanceState({ isReadonly: true }); }
    // Fit after the surface has measurable bounds, rather than during mount/layout.
    let fitFrame = 0;
    const surface = ed.getContainer();
    const fitObserver = new ResizeObserver(() => {
      if (surface.clientWidth <= 0 || surface.clientHeight <= 0) return;
      cancelAnimationFrame(fitFrame);
      fitFrame = requestAnimationFrame(() => {
        ed.updateViewportScreenBounds(surface);
        ed.zoomToFit({ animation: { duration: 0 } });
        fitObserver.disconnect();
      });
    });
    if (!stopped.current) fitObserver.observe(surface);
    let timeout: ReturnType<typeof setTimeout>;
    const stopNoteStyle = ed.sideEffects.registerBeforeCreateHandler("shape", shape => shape.type === "note" && shape.props.color === "black" ? { ...shape, props: { ...shape.props, color: "grey" } } : shape);
    const scheduleSave = () => {
      pending.current = getSnapshot(ed.store).document;
      setStatus(stopped.current ? "Error saving" : "Unsaved"); clearTimeout(timeout); timeout = setTimeout(() => void flush(), 900);
    };
    queueSave.current = scheduleSave;
    const unsubscribe = ed.store.listen(scheduleSave, { scope: "document", source: "user" });
    if (board.snapshot == null && !stopped.current) { pending.current = getSnapshot(ed.store).document; void flush(); }
    const beforeUnload = (e: BeforeUnloadEvent) => { if (pending.current || running.current) { e.preventDefault(); } };
    window.addEventListener("beforeunload", beforeUnload);
    // Override native asset import: media belongs in private Storage, never in the snapshot.
    ed.registerExternalContentHandler("files", async ({ files, point }) => {
      for (const file of files) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 20 * 1024 * 1024) { setError("Use JPEG, PNG or WebP images up to 20 MB."); continue; }
        await uploadImage({ file, point, id: crypto.randomUUID(), uploaded: false });
      }
    });
    ed.registerExternalContentHandler("url", async () => { setError("Add a saved reference through Add."); });
    ed.registerExternalContentHandler("tldraw", async info => {
      if (info.content.assets.length) { setError("Paste research cards or upload local images instead of embedded assets."); return; }
      await defaultHandleExternalTldrawContent(ed, info);
    });
    ed.registerExternalContentHandler("svg-text", async () => { setError("Use JPEG, PNG or WebP images."); });
    ed.registerExternalContentHandler("excalidraw", async () => { setError("External canvas imports are not supported yet."); });
    ed.registerExternalAssetHandler("file", async () => { throw new Error("Upload images through the board drop handler."); });
    ed.registerExternalAssetHandler("url", async () => { throw new Error("Add a saved reference instead."); });
    return () => { fitObserver.disconnect(); cancelAnimationFrame(fitFrame); queueSave.current = null; setReady(false); unsubscribe(); stopNoteStyle(); clearTimeout(timeout); void flush(); window.removeEventListener("beforeunload", beforeUnload); editor.current = null; };
  }
  return <div className="board-workspace">
    <header className="board-header"><Link href={board.research_thread_id ? `/research/${board.research_thread_id}/boards` : "/boards"} onClick={e => { if ((pending.current || running.current) && !window.confirm("Changes are not saved. Leave this board?")) e.preventDefault(); }}>Research Topic</Link><button className="board-title" onClick={() => setDetails(!details)} title="Edit board details">{title}</button><span role="status">{status}</span>{status === "Error saving" && <button onClick={() => { stopped.current = false; void flush(); }}>Retry</button>}<button className="button" disabled={!ready || licenseError} onClick={() => setPicker(!picker)}>+ Add</button>
      <button className="button" onClick={() => { const shape = editor.current?.getOnlySelectedShape(); if (shape?.type === "research-record") { const record = records.find(r => r.key === shape.props.recordKey); if (record) window.open(record.href, "_blank", "noopener,noreferrer"); } }}>Open Source</button>
      <select aria-label="Convert selected text" value="" disabled={!board.research_thread_id} onChange={e => convert(e.target.value as "note" | "reference")}><option value="">Convert to...</option><option value="note">Structured Note</option><option value="reference">Reference</option></select>
      <button className="button" title="Fit board to viewport" onClick={() => editor.current?.zoomToFit({ animation: { duration: 200 } })}>Fit</button>
    </header>
    {licenseError && <div className="board-error" role="alert">The board editor is unavailable because this deployment’s tldraw license is missing, invalid, or expired. Contact the workspace administrator. Saved board content is retained.</div>}
    {error && <div className="board-error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError("")}>Close</button></div>}
    {failedImages.length > 0 && <div className="board-error"><span>{failedImages.length} image uploads need attention</span><button disabled={busy} onClick={async () => { setBusy(true); for (const job of failedImages) await uploadImage(job); setBusy(false); }}>Retry uploads</button></div>}
    {details && <form className="board-details" onSubmit={async e => { e.preventDefault(); if (pending.current || running.current) { setError("Wait for canvas changes to save before renaming."); return; } setBusy(true); running.current = true; try { revision.current = await renameBoard(board.id, title, description, revision.current); setDetails(false); } catch (e) { setError((e as Error).message); } finally { running.current = false; setBusy(false); void flush(); } }}><label>Title<input value={title} required onChange={e => setTitle(e.target.value)} /></label><label>Description<textarea value={description} onChange={e => setDescription(e.target.value)} /></label><button className="button" disabled={busy}>Save details</button>{board.research_thread_id && <Link href={`/research/${board.research_thread_id}/boards`}>Generate another board</Link>}</form>}
    {picker && <aside className="board-picker"><input aria-label="Search research" placeholder="Search research" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Record type" value={filter} onChange={e => setFilter(e.target.value)}><option value="">All records</option>{["reference", "media", "document", "note", "theme", "project", "collection"].map(t => <option key={t}>{t}</option>)}</select><div className="board-form-row">{["text", "note", "draw", "arrow", "frame", "geo"].map(tool => <button key={tool} className="button" onClick={() => { editor.current?.setCurrentTool(tool); setPicker(false); }}>{tool === "draw" ? "Sketch" : tool === "geo" ? "Rectangle" : tool === "note" ? "Sticky" : tool}</button>)}</div><div className="board-picker-results">{records.filter(r => (!filter || r.type === filter) && `${r.title} ${r.subtitle}`.toLowerCase().includes(query.toLowerCase())).map(r => <button key={r.key} onClick={() => { if (place(r)) setPicker(false); }}><small>{r.type}</small>{r.title}</button>)}</div></aside>}
    {conversion && <div role="dialog" aria-modal="true" aria-label="Convert loose text" className="board-conversion"><form onSubmit={async e => { e.preventDefault(); setBusy(true); try { const record = await convertBoardText(board.id, conversion.id, conversion.type, conversion.title, conversion.text); setRecords(prev => [...prev.filter(r => r.key !== record.key), record]); const ed = editor.current; const shape = ed?.getShape(conversion.shapeId as RecordShape["id"]); if (ed && shape) { const point = ed.getShapePageBounds(shape)?.point; ed.run(() => { if (!place(record, point)) throw new Error("Record saved, but placement failed. Try again when the editor is available."); ed.deleteShapes([shape.id]); }); } setConversion(null); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><h2>Convert to {conversion.type}</h2><label>Title<input required value={conversion.title} onChange={e => setConversion({ ...conversion, title: e.target.value })} /></label><label>Text<textarea required value={conversion.text} onChange={e => setConversion({ ...conversion, text: e.target.value })} /></label><button disabled={busy} className="button">Create {conversion.type}</button><button type="button" className="button" onClick={() => setConversion(null)}>Cancel</button></form></div>}
    <div className="board-surface" ref={surfaceRef}><Records.Provider value={records}><Tldraw shapeUtils={shapeUtils} components={components} onMount={mount} licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY} /></Records.Provider></div>
  </div>;
}
