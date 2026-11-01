"use client";
/* eslint-disable @next/next/no-img-element -- Thumbnails are local blob URLs. */
import { useEffect, useRef, useState, type RefObject } from "react";
import { useValue, type Editor, type TLFrameShape, type TLShapeId } from "tldraw";
import { buildPdf, buildZip, moveSlide, orderSlides, slideFileName, type Slide } from "@/lib/boards/slides";

/** The board's top-level frames as slides, in deck order. */
export function useSlides(editor: Editor | null): Slide[] {
  return useValue("board slides", () => {
    if (!editor) return [];
    const frames = editor.getSortedChildIdsForParent(editor.getCurrentPageId()).flatMap(id => {
      const shape = editor.getShape(id);
      return shape?.type === "frame" ? [{ id: shape.id, x: shape.x, y: shape.y, name: (shape as TLFrameShape).props.name, meta: shape.meta as Record<string, unknown> }] : [];
    });
    return orderSlides(frames);
  }, [editor]);
}

function setMeta(editor: Editor, id: string, meta: Record<string, string | number | boolean>) {
  const shape = editor.getShape(id as TLShapeId);
  if (shape) editor.updateShape({ id: shape.id, type: shape.type, meta: { ...shape.meta, ...meta } });
}

function download(data: Uint8Array | Blob, name: string, type: string) {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function SlidesPanel({ editor, title, onPresent, onClose, onChange }: { editor: Editor; title: string; onPresent: (start: number) => void; onClose: () => void; onChange: () => void }) {
  const slides = useSlides(editor);
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const dragged = useRef<string | null>(null);
  const visible = slides.filter(s => !s.hidden);

  // Refresh thumbnails a moment after the board stops changing.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const stop = editor.store.listen(() => { clearTimeout(timer); timer = setTimeout(() => setVersion(v => v + 1), 900); }, { scope: "document" });
    return () => { clearTimeout(timer); stop(); };
  }, [editor]);

  function reorder(id: string, to: number) {
    const ids = moveSlide(slides.map(s => s.id), id, to);
    editor.markHistoryStoppingPoint("Reorder slides");
    editor.run(() => ids.forEach((sid, index) => setMeta(editor, sid, { slideIndex: index })));
    onChange();
  }
  function update(id: string, change: { name?: string; hidden?: boolean; notes?: string }) {
    const shape = editor.getShape(id as TLShapeId) as TLFrameShape | undefined;
    if (!shape) return;
    editor.run(() => {
      if (change.name !== undefined) editor.updateShape({ id: shape.id, type: "frame", props: { name: change.name } });
      if (change.hidden !== undefined) setMeta(editor, id, { slideHidden: change.hidden });
      if (change.notes !== undefined) setMeta(editor, id, { slideNotes: change.notes.slice(0, 4000) });
    });
    onChange();
  }
  function go(id: string) {
    const bounds = editor.getShapePageBounds(id as TLShapeId);
    if (bounds) editor.zoomToBounds(bounds, { inset: 48, animation: { duration: 300 } });
    editor.select(id as TLShapeId);
  }

  async function exportDeck(kind: "pdf" | "svg" | "png") {
    if (!visible.length) { setError("Add a frame to make a slide."); return; }
    setBusy(kind); setError("");
    try {
      const base = title.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Board";
      if (kind === "pdf") {
        const pages = [];
        for (const slide of visible) {
          const bounds = editor.getShapePageBounds(slide.id as TLShapeId);
          if (!bounds) continue;
          const { blob } = await editor.toImage([slide.id as TLShapeId], { format: "jpeg", quality: 0.92, scale: 2, padding: 0, background: true });
          // Frame units are CSS pixels (96 per inch); PDF pages are points (72 per inch).
          pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), pageWidth: bounds.w * 0.75, pageHeight: bounds.h * 0.75 });
        }
        download(buildPdf(pages), `${base} - slides.pdf`, "application/pdf");
      } else {
        const files = [];
        for (const [i, slide] of visible.entries()) {
          const data = kind === "svg"
            ? new TextEncoder().encode((await editor.getSvgString([slide.id as TLShapeId], { padding: 0, background: true }))?.svg ?? "")
            : new Uint8Array(await (await editor.toImage([slide.id as TLShapeId], { format: "png", scale: 2, padding: 0, background: true })).blob.arrayBuffer());
          files.push({ name: slideFileName(i + 1, slide.name, kind), data });
        }
        download(buildZip(files), `${base} - slides ${kind.toUpperCase()}.zip`, "application/zip");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally { setBusy(""); }
  }

  return <aside className="board-slides" aria-label="Slides">
    <div className="board-picker-heading"><strong>Slides</strong><button type="button" aria-label="Close slides" onClick={onClose}>×</button></div>
    <div className="board-slides-actions">
      <button type="button" className="button" disabled={!visible.length} onClick={() => onPresent(0)}>▶ Present</button>
      <select aria-label="Export slides" value="" disabled={!!busy || !visible.length} onChange={e => void exportDeck(e.target.value as "pdf" | "svg" | "png")}>
        <option value="">{busy ? "Exporting…" : "Export deck…"}</option>
        <option value="pdf">PDF (one page per slide)</option>
        <option value="svg">SVG files (zip)</option>
        <option value="png">PNG files (zip)</option>
      </select>
    </div>
    {error && <p className="board-export-error" role="alert">{error}</p>}
    {!slides.length && <p className="board-picker-empty">Every frame on the board becomes a slide. Use “Add frame…” and pick a slide size to start.</p>}
    <ol className="board-slide-list">
      {slides.map((slide, i) => <li key={slide.id} className={slide.hidden ? "is-hidden" : ""} draggable
        onDragStart={() => { dragged.current = slide.id; }} onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); if (dragged.current && dragged.current !== slide.id) reorder(dragged.current, i); dragged.current = null; }}>
        <button type="button" className="board-slide-thumb" onClick={() => go(slide.id)} title="Show on board">
          <SlideThumb editor={editor} id={slide.id} version={version} />
          <span className="board-slide-number">{slide.hidden ? "–" : visible.indexOf(slide) + 1}</span>
        </button>
        <div className="board-slide-meta">
          <input aria-label="Slide name" defaultValue={slide.name} key={slide.name} onBlur={e => { if (e.target.value.trim() && e.target.value !== slide.name) update(slide.id, { name: e.target.value.trim() }); }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} />
          <div className="board-slide-buttons">
            <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => reorder(slide.id, i - 1)}>↑</button>
            <button type="button" aria-label="Move down" disabled={i === slides.length - 1} onClick={() => reorder(slide.id, i + 1)}>↓</button>
            <button type="button" aria-pressed={slide.hidden} onClick={() => update(slide.id, { hidden: !slide.hidden })}>{slide.hidden ? "Show" : "Hide"}</button>
            <button type="button" aria-expanded={open === slide.id} onClick={() => setOpen(open === slide.id ? null : slide.id)}>Notes{slide.notes ? " •" : ""}</button>
            {!slide.hidden && <button type="button" aria-label="Present from here" onClick={() => onPresent(visible.indexOf(slide))}>▶</button>}
          </div>
          {open === slide.id && <textarea aria-label="Speaker notes" placeholder="Speaker notes (shown when you press N while presenting)" defaultValue={slide.notes} onBlur={e => { if (e.target.value !== slide.notes) update(slide.id, { notes: e.target.value }); }} />}
        </div>
      </li>)}
    </ol>
    <small className="board-export-note">Drag to reorder. Hidden frames stay on the board but are skipped when presenting and exporting.</small>
  </aside>;
}

function SlideThumb({ editor, id, version }: { editor: Editor; id: string; version: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let url = "", cancelled = false;
    const bounds = editor.getShapePageBounds(id as TLShapeId);
    if (!bounds) return;
    editor.toImage([id as TLShapeId], { format: "png", scale: Math.min(1, 240 / bounds.w), padding: 0, background: true })
      .then(({ blob }) => { if (!cancelled) { url = URL.createObjectURL(blob); setSrc(url); } })
      .catch(() => { /* A thumbnail is decorative; the slide still works without it. */ });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [editor, id, version]);
  return src ? <img src={src} alt="" /> : <span className="board-slide-blank" />;
}

/** Full-screen slideshow over the live board. */
export function Presenter({ editor, slides, start, root, onExit }: { editor: Editor; slides: Slide[]; start: number; root: RefObject<HTMLElement | null>; onExit: () => void }) {
  const [index, setIndex] = useState(Math.min(start, slides.length - 1));
  const [notes, setNotes] = useState(false);
  const [laser, setLaser] = useState(false);
  const slide = slides[index];
  const exit = useRef(onExit);
  useEffect(() => { exit.current = onExit; }, [onExit]);

  // Enter: read-only, full screen. Leave: restore the camera and editing exactly as they were.
  useEffect(() => {
    const camera = editor.getCamera();
    const readonly = editor.getInstanceState().isReadonly;
    editor.selectNone();
    editor.updateInstanceState({ isReadonly: true });
    let entered = false;
    root.current?.requestFullscreen?.().then(() => { entered = true; }).catch(() => { /* Windowed presenting still works. */ });
    const onFullscreen = () => { if (entered && !document.fullscreenElement) exit.current(); };
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      editor.setCurrentTool("select");
      editor.updateInstanceState({ isReadonly: readonly });
      editor.updateViewportScreenBounds(editor.getContainer());
      editor.setCamera(camera);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [editor, root]);

  // Fit the current slide; refit without animation whenever the screen changes size.
  const first = useRef(true);
  useEffect(() => {
    if (!slide) return;
    const fit = (animate: boolean) => {
      const bounds = editor.getShapePageBounds(slide.id as TLShapeId);
      if (!bounds) return;
      editor.updateViewportScreenBounds(editor.getContainer());
      editor.zoomToBounds(bounds, { inset: 0, ...(animate ? { animation: { duration: 550 } } : { immediate: true }) });
    };
    let frame = requestAnimationFrame(() => { fit(!first.current); first.current = false; });
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => fit(false)); });
    observer.observe(editor.getContainer());
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [editor, slide]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const next = ["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key);
      const prev = ["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key);
      if (next) setIndex(i => Math.min(i + 1, slides.length - 1));
      else if (prev) setIndex(i => Math.max(i - 1, 0));
      else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(slides.length - 1);
      else if (e.key === "Escape") exit.current();
      else if (e.key.toLowerCase() === "n") setNotes(v => !v);
      else if (e.key.toLowerCase() === "l") setLaser(v => !v);
      else return;
      e.preventDefault(); e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [slides.length]);

  useEffect(() => { editor.setCurrentTool(laser ? "laser" : "select"); }, [editor, laser]);

  // Darken everything outside the slide, tracking the camera as it moves.
  const rect = useValue("slide rect", () => {
    const bounds = slide && editor.getShapePageBounds(slide.id as TLShapeId);
    if (!bounds) return null;
    const a = editor.pageToViewport({ x: bounds.x, y: bounds.y }), b = editor.pageToViewport({ x: bounds.maxX, y: bounds.maxY });
    return { left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y };
  }, [editor, slide]);

  if (!slide) return null;
  return <>
    {rect && <div className="board-present-mask" style={rect} aria-hidden="true" />}
    <div className="board-present-bar" role="toolbar" aria-label="Presentation controls">
      <button type="button" aria-label="Previous slide" disabled={index === 0} onClick={() => setIndex(index - 1)}>‹</button>
      <span>{index + 1} / {slides.length}</span>
      <button type="button" aria-label="Next slide" disabled={index === slides.length - 1} onClick={() => setIndex(index + 1)}>›</button>
      <button type="button" aria-pressed={notes} onClick={() => setNotes(!notes)} title="Speaker notes (N)">Notes</button>
      <button type="button" aria-pressed={laser} onClick={() => setLaser(!laser)} title="Laser pointer (L)">Laser</button>
      <button type="button" onClick={() => exit.current()} title="Exit (Esc)">Exit</button>
    </div>
    {notes && <div className="board-present-notes" aria-live="polite"><strong>{slide.name}</strong>{slide.notes ? <p>{slide.notes}</p> : <p className="empty">No notes for this slide.</p>}</div>}
  </>;
}
