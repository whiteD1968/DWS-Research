"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated, server-resized thumbnail endpoint. */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tldraw, getSnapshot, DefaultColorStyle, DefaultFontStyle, defaultHandleExternalTldrawContent, renderPlaintextFromRichText, type Editor, type TLRichText } from "tldraw";
import "tldraw/tldraw.css";
import { saveBoard, renameBoard, convertBoardText, finishBoardImage } from "@/app/(workspace)/boards/actions";
import { createClient } from "@/lib/supabase/client";
import type { BoardRecord, Composition } from "@/lib/boards/layout";

import { fitResearchBoard, initializeResearchBoard, insertResearchRecord, type RecordShape } from "@/lib/boards/insertion";
import { BoardRecords, BoardSourceActions, boardShapeUtils } from "./research-board-shapes";
import { DraftJournal, removeDraft, type BoardDraft } from "@/lib/boards/drafts";
import { copyRecoveredBoard } from "@/app/(workspace)/boards/recovery-actions";
import type { BoardTransfer } from "@/lib/boards/handoff";
import { applyBoardTransfer } from "@/lib/boards/transfer";
const components = { StylePanel: null };
type ImageJob = { id: string; file: File; point?: { x: number; y: number }; uploaded: boolean };
export type BoardCanvasProps = { board: { id: string; title: string; description: string | null; research_thread_id: string | null; updated_at: string; snapshot: unknown; metadata: { composition?: Composition; generated_from?: string; source_id?: string } }; records: BoardRecord[]; ownerId: string; transfer?: BoardTransfer };

export function ResearchBoardCanvas({ board, records: initialRecords, ownerId, persist = saveBoard, recoveryDraft, recoveryWarning = "", transfer }: BoardCanvasProps & { persist?: typeof saveBoard; recoveryDraft?: BoardDraft; recoveryWarning?: string }) {
  const source = board.research_thread_id ? { href: `/research/${board.research_thread_id}/boards`, label: "Research Topic" }
    : board.metadata?.generated_from === "collection" && board.metadata.source_id ? { href: `/collections/${encodeURIComponent(board.metadata.source_id)}`, label: "Collection" }
    : board.metadata?.generated_from === "discover" && board.metadata.source_id ? { href: `/discover/sessions/${encodeURIComponent(board.metadata.source_id)}`, label: "Discover session" }
    : { href: "/boards", label: "Boards" };
  const [records, setRecords] = useState(initialRecords);
  const recordMap = useMemo(() => new Map(records.map(r => [r.key, r])), [records]);
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const [draftWarning, setDraftWarning] = useState(recoveryWarning);
  const journal = useRef<DraftJournal | null>(null);
  const copyId = useRef("");
  const router = useRouter();
  const [status, setStatus] = useState("Saved");
  const [error, setError] = useState("");
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const filteredRecords = useMemo(() => records.filter(r => (!filter || (filter === "media" ? r.type === "media" && !!r.image : r.type === filter)) && `${r.title} ${r.subtitle} ${r.creator || ""} ${r.body || ""}`.toLowerCase().includes(query.toLowerCase())), [records, filter, query]);
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
  const allowReload = useRef(false);

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
    const savingJournal = journal.current;
    try {
      await savingJournal?.settled();
      revision.current = await persist(board.id, revision.current, snapshot);
      savingJournal?.acknowledge(snapshot, revision.current);
      if (savingJournal !== journal.current) journal.current?.acknowledge(snapshot, revision.current);
      if (recoveryDraft) void removeDraft(recoveryDraft).catch(() => setDraftWarning("The saved draft could not be cleared from this browser."));
      setStatus("Saved"); setError("");
      if (transfer) window.history.replaceState(null, "", `/boards/${board.id}`);
    } catch (e) {
      pending.current ||= snapshot; stopped.current = true; setStatus("Error saving");
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally { running.current = false; }
    if (pending.current && !stopped.current) void flush();
  }
  async function saveSeparateCopy() {
    setBusy(true);
    editor.current?.updateInstanceState({ isReadonly: true });
    try {
      const snapshot = editor.current ? getSnapshot(editor.current.store).document : pending.current;
      journal.current?.write(snapshot, revision.current);
      await journal.current?.settled();
      copyId.current ||= crypto.randomUUID();
      const id = await copyRecoveredBoard(board.id, copyId.current, snapshot);
      journal.current?.acknowledge(snapshot, revision.current);
      await journal.current?.settled();
      if (recoveryDraft) await removeDraft(recoveryDraft);
      pending.current = null;
      router.push(`/boards/${id}`);
    } catch (e) {
      editor.current?.updateInstanceState({ isReadonly: false });
      setError((e as Error).message); setBusy(false);
    }
  }
  async function reloadForRecovery() {
    const ed = editor.current;
    if (!ed) return;
    setBusy(true); ed.updateInstanceState({ isReadonly: true });
    journal.current?.write(getSnapshot(ed.store).document, revision.current);
    await journal.current?.settled();
    if (journal.current?.isDurable()) { allowReload.current = true; window.location.reload(); }
    else {
      ed.updateInstanceState({ isReadonly: false }); setBusy(false);
      setError("Recovery storage is unavailable. Retry saving or save a separate board before reloading.");
    }
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
    let transferred = false;
    editor.current = ed;
    journal.current = new DraftJournal(ownerId, board.id, crypto.randomUUID(), () => setDraftWarning("Local draft backup failed. Keep this tab open until the board is saved."));
    try {
      initializeResearchBoard(ed, recoveryDraft?.snapshot ?? board.snapshot, board.metadata?.composition, initialRecords);
      if (transfer) transferred = applyBoardTransfer(ed, transfer, initialRecords);
      ed.setStyleForNextShapes(DefaultColorStyle, "black");
      ed.setStyleForNextShapes(DefaultFontStyle, "sans");
      ed.updateInstanceState({ isGridMode: false });
      setActiveEditor(ed); setReady(true);
    } catch (e) { setError(e instanceof Error ? e.message : "This board could not be loaded. No changes will be saved."); stopped.current = true; ed.updateInstanceState({ isReadonly: true }); }
    // Fit after the surface has measurable bounds, rather than during mount/layout.
    let fitFrame = 0;
    const surface = ed.getContainer();
    const fitObserver = new ResizeObserver(() => {
      if (surface.clientWidth <= 0 || surface.clientHeight <= 0) return;
      cancelAnimationFrame(fitFrame);
      fitFrame = requestAnimationFrame(() => {
        ed.updateViewportScreenBounds(surface);
        fitResearchBoard(ed);
        if (transferred) ed.zoomToSelectionIfOffscreen(48, { targetZoom: 0.75 });
        fitObserver.disconnect();
      });
    });
    if (!stopped.current) fitObserver.observe(surface);
    let timeout: ReturnType<typeof setTimeout>;
    const stopNoteStyle = ed.sideEffects.registerBeforeCreateHandler("shape", shape => shape.type === "note" && shape.props.color === "black" ? { ...shape, props: { ...shape.props, color: "grey" } } : shape);
    const scheduleSave = () => {
      copyId.current = "";
      pending.current = getSnapshot(ed.store).document;
      journal.current?.write(pending.current, revision.current);
      setStatus(stopped.current ? "Error saving" : "Unsaved"); clearTimeout(timeout); timeout = setTimeout(() => void flush(), 900);
    };
    queueSave.current = scheduleSave;
    const unsubscribe = ed.store.listen(scheduleSave, { scope: "document", source: "user" });
    if ((board.snapshot == null || recoveryDraft || transferred) && !stopped.current) { scheduleSave(); }
    const beforeUnload = (e: BeforeUnloadEvent) => { if (!allowReload.current && (pending.current || running.current)) { e.preventDefault(); } };
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
    return () => { fitObserver.disconnect(); cancelAnimationFrame(fitFrame); queueSave.current = null; setActiveEditor(null); setReady(false); unsubscribe(); stopNoteStyle(); clearTimeout(timeout); void flush(); window.removeEventListener("beforeunload", beforeUnload); editor.current = null; };
  }
  return <div className="board-workspace">
    <header className="board-header"><Link href={source.href} onClick={e => { if ((pending.current || running.current) && !window.confirm("Changes are not saved. Leave this board?")) e.preventDefault(); }}>{source.label}</Link><button className="board-title" onClick={() => setDetails(!details)} title="Edit board details">{title}</button><span role="status">{status}</span>{status === "Error saving" && <button disabled={busy} onClick={() => { stopped.current = false; void flush(); }}>Retry</button>}<button className="button" disabled={!ready || licenseError || busy} onClick={() => setPicker(!picker)}>+ Add</button>
      <BoardSourceActions editor={activeEditor} records={recordMap} />
      <select aria-label="Convert selected text" value="" disabled={!board.research_thread_id} onChange={e => convert(e.target.value as "note" | "reference")}><option value="">Convert to...</option><option value="note">Structured Note</option><option value="reference">Reference</option></select>
      <button className="button" title="Fit board to viewport" onClick={() => { if (editor.current) fitResearchBoard(editor.current, true); }}>Fit</button>
    </header>
    {draftWarning && <div className="board-error" role="alert">{draftWarning}</div>}
    {status === "Error saving" && <div className="board-error"><span>Your work is retained in this tab and, when available, in this browser’s draft storage. If another session changed the board, preserve both versions with a separate copy.</span><button disabled={busy} onClick={() => void saveSeparateCopy()}>Save as separate board</button><button disabled={busy} onClick={() => void reloadForRecovery()}>Reload and recover</button></div>}
    {licenseError && <div className="board-error" role="alert">The board editor is unavailable because this deployment’s tldraw license is missing, invalid, or expired. Contact the workspace administrator. Saved board content is retained.</div>}
    {error && <div className="board-error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError("")}>Close</button></div>}
    {failedImages.length > 0 && <div className="board-error"><span>{failedImages.length} image uploads need attention</span><button disabled={busy} onClick={async () => { setBusy(true); for (const job of failedImages) await uploadImage(job); setBusy(false); }}>Retry uploads</button></div>}
    {details && <form className="board-details" onSubmit={async e => { e.preventDefault(); if (pending.current || running.current) { setError("Wait for canvas changes to save before renaming."); return; } setBusy(true); running.current = true; try { revision.current = await renameBoard(board.id, title, description, revision.current); setDetails(false); } catch (e) { setError((e as Error).message); } finally { running.current = false; setBusy(false); void flush(); } }}><label>Title<input value={title} required onChange={e => setTitle(e.target.value)} /></label><label>Description<textarea value={description} onChange={e => setDescription(e.target.value)} /></label><button className="button" disabled={busy}>Save details</button>{board.research_thread_id && <Link href={`/research/${board.research_thread_id}/boards`}>Generate another board</Link>}</form>}
    {picker && <aside className="board-picker" aria-label="Add research">
      <div className="board-picker-heading"><strong>Add research</strong><button type="button" aria-label="Close Add drawer" onClick={() => setPicker(false)}>×</button></div>
      <input aria-label="Search research" placeholder="Search title, creator or text" value={query} onChange={e => setQuery(e.target.value)} />
      <div className="board-picker-filters" role="group" aria-label="Record type">{[["", "All"], ["reference", "References"], ["media", "Images"], ["document", "Documents"], ["note", "Notes"], ["theme", "Themes"], ["project", "Projects"], ["collection", "Collections"]].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <div className="board-picker-results">{filteredRecords.map(r => <button key={r.key} onClick={() => { if (place(r)) setPicker(false); }}>
        {r.image ? <img src={r.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : <span className="board-picker-kind" aria-hidden="true">{r.type === "document" ? "DOC" : r.type === "note" ? "Aa" : r.type === "theme" ? "#" : "↗"}</span>}
        <span><strong>{r.title}</strong><small>{r.type}{r.creator ? ` · ${r.creator}` : ""}</small></span>
      </button>)}
      {!filteredRecords.length && <p className="board-picker-empty">No matching records.</p>}</div>
      <div className="board-picker-tools"><small>Sketch & annotate</small><div className="board-form-row">{["text", "note", "draw", "arrow", "frame", "geo"].map(tool => <button key={tool} className="button" onClick={() => { editor.current?.setCurrentTool(tool); setPicker(false); }}>{tool === "draw" ? "Sketch" : tool === "geo" ? "Rectangle" : tool === "note" ? "Sticky" : tool}</button>)}</div></div>
    </aside>}
    {conversion && <div role="dialog" aria-modal="true" aria-label="Convert loose text" className="board-conversion"><form onSubmit={async e => { e.preventDefault(); setBusy(true); try { const record = await convertBoardText(board.id, conversion.id, conversion.type, conversion.title, conversion.text); setRecords(prev => [...prev.filter(r => r.key !== record.key), record]); const ed = editor.current; const shape = ed?.getShape(conversion.shapeId as RecordShape["id"]); if (ed && shape) { const point = ed.getShapePageBounds(shape)?.point; ed.run(() => { if (!place(record, point)) throw new Error("Record saved, but placement failed. Try again when the editor is available."); ed.deleteShapes([shape.id]); }); } setConversion(null); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><h2>Convert to {conversion.type}</h2><label>Title<input required value={conversion.title} onChange={e => setConversion({ ...conversion, title: e.target.value })} /></label><label>Text<textarea required value={conversion.text} onChange={e => setConversion({ ...conversion, text: e.target.value })} /></label><button disabled={busy} className="button">Create {conversion.type}</button><button type="button" className="button" onClick={() => setConversion(null)}>Cancel</button></form></div>}
    <div className="board-surface" ref={surfaceRef}><BoardRecords.Provider value={recordMap}><Tldraw shapeUtils={boardShapeUtils} components={components} onMount={mount} licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY} /></BoardRecords.Provider></div>
  </div>;
}
