"use client";
import { useMemo, useState } from "react";
import { createShapeId, toRichText, useValue, type Editor, type TLArrowShape, type TLContent, type TLFrameShape, type TLShape, type TLShapeId } from "tldraw";
import {
  SAVED_KEY, SAVED_LIMIT, SAVED_MAX_BYTES, TEMPLATES, TEMPLATE_GROUPS, clearOrigin, isSlideGroup, parseSaved, stripForTemplate, templateBounds, templateOrigin,
  type BoardTemplate, type SavedTemplate,
} from "@/lib/boards/templates";
import { boxColor } from "@/lib/boards/diagram";
import { useSlides } from "./board-slides";
import { DEFAULT_BOX, DEFAULT_LINE, boxPath, readBox, readLine } from "@/lib/boards/lines";
import type { DiagramBoxShape } from "./board-diagram";
import type { GridShape, NumeralShape, RatingShape } from "./board-studio";

const SLIDE_GAP = 160;

/** Put a template on the board. Slide templates join the end of the deck; others land in view. */
export function insertTemplate(editor: Editor, template: BoardTemplate, deckSize: number) {
  const pieces = template.pieces;
  const bounds = templateBounds(pieces);
  const slideTemplate = isSlideGroup(template.group);
  let after: { x: number; y: number } | undefined;
  if (slideTemplate) {
    const frames = editor.getSortedChildIdsForParent(editor.getCurrentPageId()).map(id => editor.getShape(id)).filter((s): s is TLFrameShape => s?.type === "frame" && !s.meta.slideHidden && !s.meta.boardZone && typeof s.meta.recordKey !== "string");
    if (frames.length) {
      const last = frames.reduce((a, b) => (b.x + b.props.w > a.x + a.props.w ? b : a));
      after = { x: last.x + last.props.w + SLIDE_GAP, y: last.y };
    }
  }
  const placed = templateOrigin(bounds, editor.getViewportPageBounds().center, after);
  const occupied = editor.getSortedChildIdsForParent(editor.getCurrentPageId()).flatMap(id => {
    const b = editor.getShapePageBounds(id);
    return b ? [{ x: b.x, y: b.y, w: b.w, h: b.h }] : [];
  });
  const origin = after ? placed : clearOrigin(bounds, placed, occupied);
  const ids = new Map<string, TLShapeId>();
  const idFor = (ref?: string) => {
    if (!ref) return createShapeId();
    if (!ids.has(ref)) ids.set(ref, createShapeId());
    return ids.get(ref)!;
  };
  const place = (p: { parent?: string; x: number; y: number }) => p.parent
    ? { parentId: idFor(p.parent), x: p.x, y: p.y }
    : { parentId: editor.getCurrentPageId(), x: origin.x + p.x, y: origin.y + p.y };
  const created: TLShapeId[] = [];
  let slideIndex = deckSize;

  editor.markHistoryStoppingPoint(`Insert ${template.label}`);
  editor.run(() => {
    for (const p of pieces) {
      if (p.kind === "connect") continue;
      const id = idFor("ref" in p ? p.ref : undefined);
      if (!("parent" in p && p.parent)) created.push(id);
      const at = place(p);
      switch (p.kind) {
        case "frame":
          editor.createShape<TLFrameShape>({ id, type: "frame", ...at, props: { w: p.w, h: p.h, name: p.name },
            meta: p.slide ? { slideIndex: slideIndex++, ...(p.notes ? { slideNotes: p.notes } : {}) } : { slideHidden: true } });
          break;
        case "text":
          editor.createShape({ id, type: "text", ...at, props: { richText: toRichText(p.text), w: p.w, autoSize: false, size: p.size, font: p.font ?? "sans", textAlign: p.align ?? "start", color: p.color ?? "black" } });
          break;
        case "placeholder":
          editor.createShape({ id, type: "geo", ...at, meta: { templatePlaceholder: true },
            props: { geo: "rectangle", w: p.w, h: p.h, fill: "semi", dash: "dashed", color: "grey", size: "s", font: "sans", richText: toRichText(p.label) } });
          break;
        case "shape":
          editor.createShape({ id, type: "geo", ...at, props: { geo: p.geo, w: p.w, h: p.h, fill: p.fill ?? "none", dash: p.dash ?? "solid", color: p.color ?? "black", size: "s", font: "sans", ...(p.label ? { richText: toRichText(p.label) } : {}) } });
          break;
        case "note":
          editor.createShape({ id, type: "note", ...at, props: { richText: toRichText(p.text), color: p.color ?? "yellow", size: "s", font: "sans" } });
          break;
        case "box":
          editor.createShape<DiagramBoxShape>({ id, type: "diagram-box", ...at, isLocked: !!p.locked, ...(p.box ? { meta: { box: { ...DEFAULT_BOX, ...p.box } } } : {}),
            props: { w: p.w, h: p.h, title: p.title, body: p.body ?? "", color: p.color ?? "black" } });
          break;
        case "line":
          editor.createShape<TLArrowShape>({ id, type: "arrow", ...at, ...(p.line ? { meta: { line: { ...DEFAULT_LINE, ...p.line } } } : {}),
            props: { kind: "arc", dash: p.dash ?? "solid", size: "s", color: "black", arrowheadStart: "none", arrowheadEnd: p.line ? "none" : p.end ?? "none", start: { x: 0, y: 0 }, end: { x: p.dx, y: p.dy } } });
          break;
        case "rating":
          editor.createShape<RatingShape>({ id, type: "rating-meter", ...at, props: { w: p.w, h: p.h, label: p.label, value: p.value, max: p.max ?? 5, ink: p.ink ?? "#111111" } });
          break;
        case "grid":
          editor.createShape<GridShape>({ id, type: "study-grid", ...at, props: { w: p.w, h: p.h, rows: p.rows, cols: p.cols, ink: p.ink ?? "#9a9c95" } });
          break;
        case "numeral":
          editor.createShape<NumeralShape>({ id, type: "numeral", ...at, props: { w: p.w, h: p.h, text: p.text, style: p.style ?? "hatch", ink: p.ink ?? "#111111" } });
          break;
      }
    }
    for (const p of pieces) {
      if (p.kind !== "connect") continue;
      const arrow = createShapeId();
      created.push(arrow);
      editor.createShape<TLArrowShape>({ id: arrow, type: "arrow", parentId: editor.getCurrentPageId(), x: 0, y: 0, ...(p.line ? { meta: { line: { ...DEFAULT_LINE, ...p.line } } } : {}), props: {
        kind: "elbow", dash: "solid", size: "s", color: "black", arrowheadStart: "none", arrowheadEnd: p.line ? "none" : "arrow", start: { x: 0, y: 0 }, end: { x: 1, y: 1 },
        ...(p.label ? { richText: toRichText(p.label) } : {}),
      } });
      const bind = (to: TLShapeId, terminal: "start" | "end") => editor.createBinding({ type: "arrow", fromId: arrow, toId: to, props: { terminal, normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false, snap: "none" } });
      bind(idFor(p.from), "start"); bind(idFor(p.to), "end");
    }
  });
  editor.select(...created);
  editor.setCurrentTool("select");
  editor.zoomToSelection({ animation: { duration: 260 } });
  return created;
}

/** A small drawing of a template, so the list reads at a glance. */
function TemplatePreview({ template }: { template: BoardTemplate }) {
  const drawing = useMemo(() => {
    const b = templateBounds(template.pieces);
    const pad = Math.max(b.w, b.h) * 0.04;
    const frames = new Map<string, { x: number; y: number }>();
    for (const p of template.pieces) if (p.kind === "frame") frames.set(p.ref, { x: p.x, y: p.y });
    const boxes = new Map<string, { x: number; y: number; w: number; h: number }>();
    const abs = (p: { parent?: string; x: number; y: number }) => {
      const f = p.parent ? frames.get(p.parent) : undefined;
      return { x: p.x + (f?.x ?? 0), y: p.y + (f?.y ?? 0) };
    };
    const items = template.pieces.map((p, i) => {
      if (p.kind === "connect") return null;
      const { x, y } = abs(p as { parent?: string; x: number; y: number });
      switch (p.kind) {
        case "frame": return <rect key={i} x={x} y={y} width={p.w} height={p.h} fill={p.slide ? "#ffffff" : "#f4f3ef"} stroke="#8a8d86" strokeWidth={b.w / 220} />;
        case "placeholder": return <rect key={i} x={x} y={y} width={p.w} height={p.h} fill="#dedcd4" />;
        case "shape": {
          const fill = p.fill === "none" ? "none" : boxColor(p.color ?? "black").band;
          return p.geo === "ellipse" ? <ellipse key={i} cx={x + p.w / 2} cy={y + p.h / 2} rx={p.w / 2} ry={p.h / 2} fill={fill} stroke="#3a3a37" strokeWidth={b.w / 300} />
            : <rect key={i} x={x} y={y} width={p.w} height={p.h} fill={fill} fillOpacity={p.fill === "semi" ? 0.5 : 1} stroke="#3a3a37" strokeWidth={b.w / 300} />;
        }
        case "note": return <rect key={i} x={x} y={y} width={200} height={200} fill={boxColor(p.color ?? "yellow").band} />;
        case "box": {
          boxes.set(p.ref, { x, y, w: p.w, h: p.h });
          if (p.box) {
            const box = readBox({ ...DEFAULT_BOX, ...p.box });
            return <path key={i} transform={`translate(${x} ${y})`} d={boxPath(p.w, p.h, box.corner, box.cut)} fill={box.fill === "none" ? "none" : box.fill}
              stroke={box.color} strokeWidth={Math.max(b.w / 400, box.weight * (box.hatch ? 6 : 2))} strokeDasharray={box.pattern === "solid" ? undefined : `${b.w / 200} ${b.w / 200}`} />;
          }
          return <g key={i}><rect x={x} y={y} width={p.w} height={p.h} fill="#ffffff" stroke="#3a3a37" strokeWidth={b.w / 300} /><rect x={x} y={y} width={p.w} height={p.h * 0.25} fill={boxColor(p.color ?? "black").band} /></g>;
        }
        case "rating": {
          const n = p.max ?? 5, s = Math.min(p.h, p.w / (n * 2.4));
          return <g key={i} fill={p.ink ?? "#111111"}>{Array.from({ length: n }, (_, k) => <rect key={k} x={x + p.w - (n - k) * s * 1.4} y={y} width={s} height={s} fillOpacity={k < p.value ? 1 : 0.3} />)}</g>;
        }
        case "grid": return <rect key={i} x={x} y={y} width={p.w} height={p.h} fill="none" stroke={p.ink ?? "#9a9c95"} strokeWidth={b.w / 400} strokeDasharray={`${b.w / 150} ${b.w / 150}`} />;
        case "numeral": return <text key={i} x={x} y={y + p.h * 0.85} fontSize={p.h} fontWeight={800} fontFamily="Arial, sans-serif" textLength={p.w} lengthAdjust="spacingAndGlyphs"
          fill={p.style === "solid" ? p.ink : "none"} stroke={p.ink ?? "#111111"} strokeWidth={b.w / 300}>{p.text}</text>;
        case "text": {
          const h = p.size === "xl" ? 44 : p.size === "l" ? 32 : p.size === "m" ? 22 : 14;
          const w = Math.min(p.w, p.text.length * h * 0.5);
          const left = p.align === "middle" ? x + (p.w - w) / 2 : p.align === "end" ? x + p.w - w : x;
          return <rect key={i} x={left} y={y + 6} width={w} height={h} rx={h / 4} fill={p.color === "grey" ? "#b3b5ad" : p.color === "white" ? "#f4f3ef" : p.color === "light-green" ? "#d4f53c" : "#3a3a37"} />;
        }
        case "line": {
          const line = p.line ? readLine({ ...DEFAULT_LINE, ...p.line }) : null;
          return <line key={i} x1={x} y1={y} x2={x + p.dx} y2={y + p.dy} stroke={line?.color ?? "#3a3a37"} strokeWidth={b.w / (line ? 400 : 250)} strokeDasharray={line && line.pattern !== "solid" ? `${b.w / 250} ${b.w / 250}` : undefined} />;
        }
      }
    });
    const links = template.pieces.flatMap((p, i) => {
      if (p.kind !== "connect") return [];
      const a = boxes.get(p.from), z = boxes.get(p.to);
      return a && z ? [<line key={`c${i}`} x1={a.x + a.w / 2} y1={a.y + a.h / 2} x2={z.x + z.w / 2} y2={z.y + z.h / 2} stroke={p.line?.color ?? "#3a3a37"} strokeWidth={b.w / 250} />] : [];
    });
    return { viewBox: `${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`, items: [...links, ...items] };
  }, [template]);
  return <svg className="board-template-preview" viewBox={drawing.viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">{drawing.items}</svg>;
}

function readSaved() { return typeof window === "undefined" ? [] : parseSaved(localStorage.getItem(SAVED_KEY)); }

export function TemplatesPanel({ editor, onClose, onChange }: { editor: Editor; onClose: () => void; onChange: () => void }) {
  const deck = useSlides(editor);
  const selection = useValue("template selection", () => editor.getSelectedShapeIds().length, [editor]);
  const [saved, setSaved] = useState<SavedTemplate[]>(readSaved); // the drawer only renders in the browser, after the editor mounts
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [group, setGroup] = useState<string>("Slide layouts");

  function insert(template: BoardTemplate) {
    insertTemplate(editor, template, deck.length);
    editor.focus();
    setNote(`Added “${template.label}”.`);
    onChange();
  }
  function save() {
    const ids = editor.getSelectedShapeIds();
    const content = ids.length ? editor.getContentFromCurrentPage(ids) : undefined;
    if (!content) { setNote("Select what you want to keep as a template first."); return; }
    const { content: kept, kept: count, left } = stripForTemplate(content as unknown as Parameters<typeof stripForTemplate>[0]);
    if (!count) { setNote("Templates keep layout and drawing. Research cards and images are left out, and nothing else was selected."); return; }
    const entry: SavedTemplate = { id: crypto.randomUUID(), name: name.trim().slice(0, 80) || `Template ${saved.length + 1}`, created: new Date().toISOString(), content: kept, count };
    const next = [entry, ...readSaved()].slice(0, SAVED_LIMIT);
    const json = JSON.stringify(next);
    if (JSON.stringify(entry).length > SAVED_MAX_BYTES) { setNote("That selection is too large to keep as a template. Try fewer shapes."); return; }
    try { localStorage.setItem(SAVED_KEY, json); } catch { setNote("This browser's template storage is full. Delete an old template and try again."); return; }
    setSaved(next); setName("");
    setNote(left ? `Saved “${entry.name}”. ${left} research card${left === 1 ? "" : "s"} or image${left === 1 ? "" : "s"} left out; templates keep layout only.` : `Saved “${entry.name}”.`);
  }
  function addSaved(t: SavedTemplate) {
    editor.markHistoryStoppingPoint(`Insert ${t.name}`);
    try {
      editor.putContentOntoCurrentPage(t.content as TLContent, { point: editor.getViewportPageBounds().center, select: true });
    } catch { setNote("That template could not be added. It may come from an older version of the board."); return; }
    // New top-level frames join the end of the deck.
    let index = deck.length;
    const frames = editor.getSelectedShapes().filter((s): s is TLShape & TLFrameShape => s.type === "frame" && s.parentId === editor.getCurrentPageId() && !s.meta.slideHidden);
    editor.run(() => frames.forEach(f => editor.updateShape({ id: f.id, type: "frame", meta: { ...f.meta, slideIndex: index++ } })));
    editor.setCurrentTool("select");
    editor.zoomToSelection({ animation: { duration: 260 } });
    editor.focus();
    setNote(`Added “${t.name}”.`);
    onChange();
  }
  function remove(t: SavedTemplate) {
    if (!window.confirm(`Delete the template “${t.name}”? Boards that used it keep their copy.`)) return;
    const next = readSaved().filter(x => x.id !== t.id);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    setSaved(next);
  }

  const groups = [...TEMPLATE_GROUPS, "My templates"];
  return <aside className="board-templates" aria-label="Templates">
    <div className="board-picker-heading"><strong>Templates</strong><button type="button" aria-label="Close templates" onClick={onClose}>×</button></div>
    <div className="board-template-tabs" role="tablist">
      {groups.map(g => <button key={g} type="button" role="tab" aria-selected={group === g} onClick={() => setGroup(g)}>{g}</button>)}
    </div>
    {note && <p className="board-template-note" role="status">{note}</p>}
    {group === "My templates" ? <div className="board-template-saved">
      <form onSubmit={e => { e.preventDefault(); save(); }}>
        <label>Save the selection as a template
          <input value={name} maxLength={80} placeholder={selection ? "Template name" : "Select shapes on the board first"} onChange={e => setName(e.target.value)} />
        </label>
        <button type="submit" className="button" disabled={!selection}>Save{selection ? ` ${selection} shape${selection === 1 ? "" : "s"}` : ""}</button>
        <small>Keeps frames, text, shapes, sticky notes, boxes and connectors. Research cards and images are left out. Saved in this browser.</small>
      </form>
      {saved.length === 0 ? <p className="board-template-empty">No saved templates yet.</p> : <ul>
        {saved.map(t => <li key={t.id}>
          <button type="button" className="board-template-item" onClick={() => addSaved(t)}><strong>{t.name}</strong><small>{t.count} shape{t.count === 1 ? "" : "s"} · {new Date(t.created).toLocaleDateString()}</small></button>
          <button type="button" className="board-template-delete" aria-label={`Delete template ${t.name}`} onClick={() => remove(t)}>×</button>
        </li>)}
      </ul>}
    </div> : <ul className="board-template-grid">
      {TEMPLATES.filter(t => t.group === group).map(t => <li key={t.id}>
        <button type="button" className="board-template-item" onClick={() => insert(t)} title={`Add ${t.label}`}>
          <TemplatePreview template={t} />
          <strong>{t.label}</strong><small>{t.description}</small>
        </button>
      </li>)}
    </ul>}
    {(group === "Slide layouts" || group === "Decks") && <small className="board-template-hint">Slides are added after the last slide. Drop image cards onto a grey placeholder, select both, and choose Fit to placeholder.</small>}
  </aside>;
}

/** Selected: one placeholder plus one card or shape. Puts the shape where the placeholder was. */
export function fitToPlaceholder(editor: Editor) {
  const shapes = editor.getSelectedShapes();
  if (shapes.length !== 2) return false;
  const holder = shapes.find(s => s.meta.templatePlaceholder);
  const other = shapes.find(s => s !== holder);
  if (!holder || !other || holder.type !== "geo") return false;
  const props = other.props as { w?: number; h?: number };
  if (typeof props.w !== "number" || typeof props.h !== "number") return false;
  const { w, h } = holder.props as { w: number; h: number };
  editor.markHistoryStoppingPoint("Fit to placeholder");
  editor.run(() => {
    if (other.parentId !== holder.parentId) editor.reparentShapes([other.id], holder.parentId);
    editor.updateShape({ id: other.id, type: other.type, x: holder.x, y: holder.y, rotation: holder.rotation, props: { w, h } } as Parameters<Editor["updateShape"]>[0]);
    editor.deleteShape(holder.id);
  });
  editor.select(other.id);
  return true;
}
