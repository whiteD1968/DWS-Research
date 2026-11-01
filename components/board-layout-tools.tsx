"use client";
import { useEffect, useState } from "react";
import { createShapeId, exportAs, useValue, type Editor, type TLShapeId } from "tldraw";
import { fitToPlaceholder } from "./board-templates";
import { FRAME_PRESETS, exportFileName, type ExportScope } from "@/lib/boards/layout-tools";

const GRID_KEY = "dws-board-grid";

/** Header controls: frame presets, grid and snapping, and export. */
export function BoardLayoutTools({ editor, title, onChange }: { editor: Editor | null; title: string; onChange: () => void }) {
  const grid = useValue("board grid", () => editor?.getInstanceState().isGridMode ?? false, [editor]);
  const snap = useValue("board snap", () => editor?.user.getIsSnapMode() ?? false, [editor]);
  const [exporting, setExporting] = useState(false);

  // Grid is a per-browser viewing preference, not part of the saved board.
  useEffect(() => {
    if (editor && localStorage.getItem(GRID_KEY) === "on") editor.updateInstanceState({ isGridMode: true });
  }, [editor]);

  function addFrame(index: string) {
    const preset = FRAME_PRESETS[Number(index)];
    if (!editor || !preset) return;
    const id = createShapeId();
    const center = editor.getViewportPageBounds().center;
    editor.markHistoryStoppingPoint("Add frame");
    editor.createShape({ id, type: "frame", x: Math.round(center.x - preset.w / 2), y: Math.round(center.y - preset.h / 2), props: { w: preset.w, h: preset.h, name: preset.label } });
    editor.select(id);
    editor.setCurrentTool("select");
    editor.zoomToSelection({ animation: { duration: 220 } });
    editor.focus();
    onChange();
  }
  function toggleGrid() {
    if (!editor) return;
    editor.updateInstanceState({ isGridMode: !grid });
    localStorage.setItem(GRID_KEY, grid ? "off" : "on");
  }

  return <div className="board-layout-tools">
    <select aria-label="Add a sized frame" value="" disabled={!editor} onChange={e => addFrame(e.target.value)}>
      <option value="">Add frame…</option>
      {groups().map(group => <optgroup key={group} label={group}>{FRAME_PRESETS.map((p, i) => p.group === group && <option key={p.label} value={i}>{p.label}</option>)}</optgroup>)}
    </select>
    <button type="button" className="button" aria-pressed={grid} disabled={!editor} onClick={toggleGrid} title="Show grid; shapes snap to it while it is on">Grid</button>
    <button type="button" className="button" aria-pressed={snap} disabled={!editor} onClick={() => editor?.user.updateUserPreferences({ isSnapMode: !snap })} title="Snap to other shapes' edges and centres (hold Ctrl/Cmd to snap once)">Snap</button>
    <button type="button" className="button" aria-expanded={exporting} disabled={!editor} onClick={() => setExporting(!exporting)}>Export</button>
    {exporting && editor && <ExportPanel editor={editor} title={title} onClose={() => setExporting(false)} />}
  </div>;
}

function groups() { return [...new Set(FRAME_PRESETS.map(p => p.group))]; }

function ExportPanel({ editor, title, onClose }: { editor: Editor; title: string; onClose: () => void }) {
  const selection = useValue("export selection", () => editor.getSelectedShapes(), [editor]);
  const frame = selection.length === 1 && selection[0].type === "frame" ? selection[0] : null;
  const [scope, setScope] = useState<ExportScope>(frame ? "frame" : selection.length ? "selection" : "board");
  const [format, setFormat] = useState<"svg" | "png">("svg");
  const [scale, setScale] = useState(2);
  const [background, setBackground] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const effective: ExportScope = scope === "frame" && !frame ? (selection.length ? "selection" : "board") : scope === "selection" && !selection.length ? "board" : scope;

  async function run() {
    const ids: TLShapeId[] = effective === "board" ? [...editor.getCurrentPageShapeIds()] : selection.map(s => s.id);
    if (!ids.length) { setError("This board is empty."); return; }
    setBusy(true); setError("");
    try {
      const name = exportFileName(title, effective, frame?.type === "frame" ? (frame.props as { name?: string }).name : undefined);
      await exportAs(editor, ids, { format, scale: format === "png" ? scale : 1, background, padding: effective === "frame" ? 0 : 32, name });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally { setBusy(false); }
  }

  return <div className="board-export" role="dialog" aria-label="Export board">
    <div className="board-picker-heading"><strong>Export</strong><button type="button" aria-label="Close export" onClick={onClose}>×</button></div>
    <fieldset><legend>What</legend>
      <label><input type="radio" name="export-scope" checked={effective === "frame"} disabled={!frame} onChange={() => setScope("frame")} /> Selected frame{frame ? `: ${(frame.props as { name?: string }).name || "Frame"}` : ""}</label>
      <label><input type="radio" name="export-scope" checked={effective === "selection"} disabled={!selection.length} onChange={() => setScope("selection")} /> Selection{selection.length ? ` (${selection.length})` : ""}</label>
      <label><input type="radio" name="export-scope" checked={effective === "board"} onChange={() => setScope("board")} /> Whole board</label>
    </fieldset>
    <fieldset><legend>Format</legend>
      <label><input type="radio" name="export-format" checked={format === "svg"} onChange={() => setFormat("svg")} /> SVG (vector)</label>
      <label><input type="radio" name="export-format" checked={format === "png"} onChange={() => setFormat("png")} /> PNG</label>
      {format === "png" && <label>Scale <select value={scale} onChange={e => setScale(Number(e.target.value))}>{[1, 2, 4].map(s => <option key={s} value={s}>{s}x</option>)}</select></label>}
    </fieldset>
    <label><input type="checkbox" checked={background} onChange={e => setBackground(e.target.checked)} /> Include background</label>
    {format === "svg" && <small className="board-export-note">Exports as editable vectors: text stays text, and card images are embedded, so the file opens in Illustrator, Inkscape, Figma and Penpot.</small>}
    {error && <p className="board-export-error" role="alert">{error}</p>}
    <button type="button" className="button" disabled={busy} onClick={() => void run()}>{busy ? "Exporting…" : `Download ${format.toUpperCase()}`}</button>
  </div>;
}

/** Floating bar shown while two or more shapes are selected. */
export function BoardArrangeBar({ editor, onChange }: { editor: Editor | null; onChange: () => void }) {
  const count = useValue("selected count", () => editor?.getSelectedShapeIds().length ?? 0, [editor]);
  const placeholder = useValue("placeholder selected", () => count === 2 && !!editor?.getSelectedShapes().some(s => s.meta.templatePlaceholder), [editor, count]);
  if (!editor || count < 2) return null;
  const act = (label: string, fn: (ids: TLShapeId[]) => void) => () => {
    editor.markHistoryStoppingPoint(label);
    fn(editor.getSelectedShapeIds());
    onChange();
  };
  const buttons: [string, string, () => void][] = [
    ["⇤", "Align left", act("Align left", ids => editor.alignShapes(ids, "left"))],
    ["↔", "Align centres horizontally", act("Align centre", ids => editor.alignShapes(ids, "center-horizontal"))],
    ["⇥", "Align right", act("Align right", ids => editor.alignShapes(ids, "right"))],
    ["⤒", "Align top", act("Align top", ids => editor.alignShapes(ids, "top"))],
    ["↕", "Align centres vertically", act("Align middle", ids => editor.alignShapes(ids, "center-vertical"))],
    ["⤓", "Align bottom", act("Align bottom", ids => editor.alignShapes(ids, "bottom"))],
  ];
  const spacing: [string, string, () => void][] = count >= 3 ? [
    ["Space ↔", "Distribute evenly across", act("Distribute", ids => editor.distributeShapes(ids, "horizontal"))],
    ["Space ↕", "Distribute evenly down", act("Distribute", ids => editor.distributeShapes(ids, "vertical"))],
  ] : [];
  const stack: [string, string, () => void][] = [
    ["Row", "Line up in a row with even gaps", act("Stack", ids => editor.stackShapes(ids, "horizontal", 24))],
    ["Column", "Line up in a column with even gaps", act("Stack", ids => editor.stackShapes(ids, "vertical", 24))],
  ];
  return <div className="board-arrange" role="toolbar" aria-label="Arrange selection">
    {placeholder && <button type="button" className="board-arrange-fit" title="Move and resize the other shape to fill the placeholder" onClick={() => { if (fitToPlaceholder(editor)) onChange(); }}>Fit to placeholder</button>}
    {[...buttons, ...spacing, ...stack].map(([label, name, onClick]) => <button key={name} type="button" title={name} aria-label={name} onClick={onClick}>{label}</button>)}
  </div>;
}
