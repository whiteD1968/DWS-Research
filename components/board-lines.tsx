"use client";
import { useState } from "react";
import { ArrowShapeUtil, Mat, SVGContainer, getArrowInfo, useValue, type Editor, type SvgExportContext, type TLArrowInfo, type TLArrowShape, type TLShape } from "tldraw";
import { crossings, hopPath, routeAround, runsThrough, type Rect } from "@/lib/boards/routing";
import {
  BOX_FILLS, BUILT_IN_STYLES, CORNERS, DEFAULT_BOX, DEFAULT_LINE, END_SIZES, ENDS, HATCHES, HEADERS, SHADOWS, CORNER_KINDS, SIDE_HATCHES, cornerKinds, LINE_COLORS, PATTERNS, PT, RADII, STYLES_KEY, WEIGHTS,
  dashArray, endInset, endMark, parseStyles, readBox, readLine, roundedPath, simplify, trimEnds,
  type BoxSpec, type LineSpec, type LineStyle,
} from "@/lib/boards/lines";

type Pt = { x: number; y: number };

/** Shapes a routed line keeps clear of. Frames count too, unless the line starts or ends inside one. */
const OBSTACLES = new Set(["diagram-box", "geo", "note", "image", "video", "research-record", "frame"]);
const unit = (a: Pt, b: Pt) => { const d = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / d, y: (b.y - a.y) / d }; };

/** The points a precise line is drawn through, in its own space: tldraw's route, or one around boxes when asked. */
function drawnPoints(editor: Editor, shape: TLArrowShape, line: LineSpec, info = getArrowInfo(editor, shape)): Pt[] | null {
  if (!info?.isValid || info.type === "arc") return null;
  const raw = info.type === "elbow" ? info.route.points.map(p => ({ x: p.x, y: p.y })) : [info.start.point, info.end.point];
  if (!line.avoid || info.type !== "elbow" || raw.length < 2) return raw;
  const toLocal = Mat.Inverse(editor.getShapePageTransform(shape.id));
  const start = raw[0], end = raw[raw.length - 1];
  const span = { x: Math.min(start.x, end.x) - 600, y: Math.min(start.y, end.y) - 600, maxX: Math.max(start.x, end.x) + 600, maxY: Math.max(start.y, end.y) + 600 };
  const obstacles: Rect[] = editor.getCurrentPageShapes().flatMap(o => {
    if (o.id === shape.id || o.isLocked || !OBSTACLES.has(o.type)) return [];
    const b = editor.getShapePageBounds(o.id);
    if (!b) return [];
    const corners = [Mat.applyToPoint(toLocal, { x: b.x, y: b.y }), Mat.applyToPoint(toLocal, { x: b.maxX, y: b.maxY })];
    const r = { x: Math.min(corners[0].x, corners[1].x), y: Math.min(corners[0].y, corners[1].y), w: Math.abs(corners[1].x - corners[0].x), h: Math.abs(corners[1].y - corners[0].y) };
    const holds = (p: Pt) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;
    if (holds(start) || holds(end)) return []; // a line can't leave a box it starts inside
    if (r.x > span.maxX || r.y > span.maxY || r.x + r.w < span.x || r.y + r.h < span.y) return [];
    return [r];
  });
  // Keep tldraw's route while it is clear; only reroute when it actually runs through a box.
  if (!runsThrough(raw, obstacles)) return raw;
  return routeAround(start, unit(raw[0], raw[1]), end, unit(raw[raw.length - 1], raw[raw.length - 2]), obstacles) ?? raw;
}

/** Lines beneath this one (in drawing order) that it should hop over, in its own space. */
function linesBelow(editor: Editor, shape: TLArrowShape): Pt[][] {
  const toLocal = Mat.Inverse(editor.getShapePageTransform(shape.id));
  const out: Pt[][] = [];
  for (const o of editor.getCurrentPageShapesSorted()) {
    if (o.id === shape.id) break;
    if (o.type !== "arrow") continue;
    const arrow = o as TLArrowShape;
    const pts = drawnPoints(editor, arrow, readLine(arrow.meta.line) ?? DEFAULT_LINE);
    if (!pts) continue;
    const toPage = editor.getShapePageTransform(arrow.id);
    out.push(pts.map(p => Mat.applyToPoint(toLocal, Mat.applyToPoint(toPage, p))));
  }
  return out;
}

/** The connector's drawn line, ends included, from tldraw's routed geometry or a route of our own. */
export function lineSvg(info: TLArrowInfo | undefined, line: LineSpec, route?: { points?: Pt[] | null; below?: Pt[][] }) {
  if (!info?.isValid) return null;
  const width = line.weight * PT;
  const stroke = { stroke: line.color, strokeWidth: width, fill: "none", strokeLinecap: line.pattern === "dotted" ? "round" as const : "butt" as const, strokeLinejoin: "round" as const };
  let d: string, startFrom: Pt, endFrom: Pt;
  const start = info.start.point, end = info.end.point;
  if (info.type === "arc") {
    const { center, radius, largeArcFlag, sweepFlag } = info.bodyArc;
    d = `M${start.x},${start.y} A${radius},${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x},${end.y}`;
    // A point a little way along the arc from each end gives each line end its direction.
    const dir = sweepFlag ? 1 : -1;
    const step = Math.min(0.5, Math.max(line.startSize, line.endSize) / Math.max(radius, 1));
    const along = (p: Pt, by: number) => { const a = Math.atan2(p.y - center.y, p.x - center.x) + by; return { x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius }; };
    startFrom = along(start, dir * step); endFrom = along(end, -dir * step);
  } else {
    const raw = route?.points ?? (info.type === "elbow" ? info.route.points : [start, end]);
    const points = simplify(raw.map(p => ({ x: p.x, y: p.y })));
    if (points.length < 2) return null;
    const trimmed = trimEnds(points, endInset(line.start, line.startSize), endInset(line.end, line.endSize));
    const radius = info.type === "elbow" ? line.radius : 0;
    const hops = line.jumps && route?.below?.length ? crossings(trimmed, route.below) : [];
    d = hops.length ? hopPath(trimmed, radius, hops, Math.max(7, width * 5)) : roundedPath(trimmed, radius);
    startFrom = points[1]; endFrom = points[points.length - 2];
  }
  const marks = [endMark(line.start, start, startFrom, line.startSize), endMark(line.end, end, endFrom, line.endSize)];
  const markStroke = Math.max(width, 0.6);
  return <g className="precise-line">
    <path d={d} {...stroke} strokeDasharray={dashArray(line.pattern, line.weight)} />
    {marks.map((m, i) => !m ? null : m.kind === "circle"
      ? <g key={i}><circle cx={m.cx} cy={m.cy} r={m.r} fill={m.fill ? line.color : "none"} stroke={line.color} strokeWidth={m.fill ? 0 : markStroke} />{m.cross && <path d={m.cross} stroke={line.color} strokeWidth={markStroke} strokeLinecap="round" />}</g>
      : <path key={i} d={m.d} fill={m.fill ? line.color : "none"} stroke={line.color} strokeWidth={m.fill ? 0 : markStroke} strokeLinejoin="round" strokeLinecap="round" />)}
  </g>;
}

function preciseSvg(editor: Editor, shape: TLArrowShape, line: LineSpec) {
  const info = getArrowInfo(editor, shape);
  const points = line.avoid ? drawnPoints(editor, shape, line, info) : null;
  const below = line.jumps ? linesBelow(editor, shape) : undefined;
  return lineSvg(info, line, { points, below });
}

/**
 * Connectors with a precise line style draw their own line; tldraw still binds and labels them, and
 * routes them unless the line is set to find its own way around boxes.
 * Without one, they look exactly as before.
 */
export class PreciseArrowUtil extends ArrowShapeUtil {
  override component(shape: TLArrowShape) {
    const base = super.component(shape); // always called, so its hooks run in the same order
    const line = readLine(shape.meta.line);
    if (!line) return base;
    return <>
      <SVGContainer style={{ minWidth: 50, minHeight: 50 }}>{preciseSvg(this.editor, shape, line)}</SVGContainer>
      {base}
    </>;
  }
  override toSvg(shape: TLArrowShape, ctx: SvgExportContext) {
    const base = super.toSvg(shape, ctx);
    const line = readLine(shape.meta.line);
    if (!line) return base;
    return <g>{preciseSvg(this.editor, shape, line)}{base}</g>;
  }
}
// tldraw's own stroke is hidden for precise lines; its label keeps working.
export const preciseArrowUtil = PreciseArrowUtil.configure({
  showTextOutline: true,
  // Drafting labels are small and sit on a clear halo over the line.
  getCustomDisplayValues: (_editor, shape) => readLine(shape.meta.line) ? { strokeColor: "transparent", fillColor: "transparent", labelFontSize: 13 } : {},
});

// ---------- Applying styles ----------
const precise = (line: LineSpec) => ({ line: { ...line } });
function nextLine(editor: Editor) { return readLine(editor.getInstanceState().meta.nextLine); }
export function setNextLine(editor: Editor, line: LineSpec | null) {
  editor.updateInstanceState({ meta: { ...editor.getInstanceState().meta, nextLine: line ? { ...line } : null } });
}

/** New connectors drawn by hand, quick-added or inserted from a template take the current line style. */
export function registerLineDefaults(editor: Editor) {
  return editor.sideEffects.registerBeforeCreateHandler("shape", (shape, source) => {
    if (source !== "user" || shape.type !== "arrow" || shape.meta.line) return shape;
    const line = nextLine(editor);
    if (!line) return shape;
    const arrow = shape as TLArrowShape;
    return { ...arrow, meta: { ...arrow.meta, ...precise(line) }, props: { ...arrow.props, arrowheadStart: "none", arrowheadEnd: "none" } };
  });
}

export function applyLine(editor: Editor, arrows: TLArrowShape[], change: Partial<LineSpec> | LineSpec) {
  editor.markHistoryStoppingPoint("Line style");
  editor.run(() => editor.updateShapes(arrows.map(a => {
    const line = { ...(readLine(a.meta.line) ?? DEFAULT_LINE), ...change };
    // Routing around boxes works on elbow lines, so turning it on makes the line an elbow.
    const kind = change.avoid ? { kind: "elbow" as const } : {};
    return { id: a.id, type: "arrow" as const, meta: { ...a.meta, ...precise(line) }, props: { arrowheadStart: "none" as const, arrowheadEnd: "none" as const, ...kind } };
  })));
}
function resetLine(editor: Editor, arrows: TLArrowShape[]) {
  editor.markHistoryStoppingPoint("Board line style");
  editor.run(() => editor.updateShapes(arrows.map(a => {
    const line = readLine(a.meta.line);
    const meta = { ...a.meta };
    delete meta.line;
    return { id: a.id, type: "arrow" as const, meta, props: { arrowheadStart: line && line.start !== "none" ? "dot" as const : "none" as const, arrowheadEnd: !line || line.end !== "none" ? "arrow" as const : "none" as const } };
  })));
}
function applyRoute(editor: Editor, arrows: TLArrowShape[], route: "straight" | "elbow" | "curve") {
  editor.markHistoryStoppingPoint("Line route");
  editor.run(() => editor.updateShapes(arrows.map(a => ({ id: a.id, type: "arrow" as const, props: route === "elbow" ? { kind: "elbow" as const } : { kind: "arc" as const, bend: route === "curve" ? (a.props.bend || 40) : 0 } }))));
}
function applyBox(editor: Editor, boxes: TLShape[], change: Partial<BoxSpec>) {
  editor.markHistoryStoppingPoint("Box style");
  editor.run(() => editor.updateShapes(boxes.map(b => ({ id: b.id, type: b.type, meta: { ...b.meta, box: { ...readBox(b.meta.box), ...change } } }))));
}

// Runs follow the outline clockwise, so name each side's start and end by where they are.
const SIDE_ENDS = [["left", "right"], ["top", "bottom"], ["right", "left"], ["bottom", "top"]];
function sideLabel(side: number, id: string, label: string) {
  return id === "start" ? `${SIDE_ENDS[side][0]} part` : id === "end" ? `${SIDE_ENDS[side][1]} part` : label;
}

function readStyles() { try { return parseStyles(localStorage.getItem(STYLES_KEY)); } catch { return []; } }

// ---------- Panel ----------
function LineControls({ line, onChange }: { line: LineSpec; onChange: (change: Partial<LineSpec>) => void }) {
  return <>
    <div className="line-panel-row">
      <label>Weight<select value={line.weight} onChange={e => onChange({ weight: Number(e.target.value) })}>
        {[...new Set([...WEIGHTS, line.weight])].sort((a, b) => a - b).map(w => <option key={w} value={w}>{w} pt</option>)}
      </select></label>
      <label>Type<select value={line.pattern} onChange={e => onChange({ pattern: e.target.value as LineSpec["pattern"] })}>
        {PATTERNS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select></label>
    </div>
    <div className="line-panel-colors" role="group" aria-label="Line colour">
      {LINE_COLORS.map(c => <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={line.color === c} style={{ background: c }} onClick={() => onChange({ color: c })} />)}
      <input type="color" aria-label="Custom colour" value={line.color} onChange={e => onChange({ color: e.target.value })} />
    </div>
    <div className="line-panel-row">
      <label>Start<select value={line.start} onChange={e => onChange({ start: e.target.value as LineSpec["start"] })}>{ENDS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
      <label>Size<select value={line.startSize} onChange={e => onChange({ startSize: Number(e.target.value) })}>{[...new Set([...END_SIZES, line.startSize])].sort((a, b) => a - b).map(s => <option key={s} value={s}>{s}</option>)}</select></label>
    </div>
    <div className="line-panel-row">
      <label>End<select value={line.end} onChange={e => onChange({ end: e.target.value as LineSpec["end"] })}>{ENDS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
      <label>Size<select value={line.endSize} onChange={e => onChange({ endSize: Number(e.target.value) })}>{[...new Set([...END_SIZES, line.endSize])].sort((a, b) => a - b).map(s => <option key={s} value={s}>{s}</option>)}</select></label>
    </div>
    <label className="line-panel-wide">Elbow corners<select value={line.radius} onChange={e => onChange({ radius: Number(e.target.value) })}>
      {[...new Set([...RADII, line.radius])].sort((a, b) => a - b).map(r => <option key={r} value={r}>{r === 0 ? "Square" : `Rounded ${r}`}</option>)}
    </select></label>
    <label className="line-panel-check"><input type="checkbox" checked={!!line.avoid} onChange={e => onChange({ avoid: e.target.checked })} /> Route around boxes <small>(elbow lines)</small></label>
    <label className="line-panel-check"><input type="checkbox" checked={!!line.jumps} onChange={e => onChange({ jumps: e.target.checked })} /> Jump over lines it crosses</label>
  </>;
}

function LinePreview({ line }: { line: LineSpec }) {
  const info = { isValid: true, type: "elbow", start: { point: { x: 8, y: 8 } }, end: { point: { x: 152, y: 26 } }, route: { points: [{ x: 8, y: 8 }, { x: 80, y: 8 }, { x: 80, y: 26 }, { x: 152, y: 26 }] } } as unknown as TLArrowInfo;
  return <svg className="line-panel-preview" viewBox="0 0 160 34" aria-hidden="true">{lineSvg(info, line)}</svg>;
}

/** Shown while connectors or headed boxes are selected, or the connector tool is active. */
export function LinePanel({ editor, onChange }: { editor: Editor | null; onChange: () => void }) {
  const state = useValue("line panel", () => {
    if (!editor || editor.getEditingShapeId()) return null;
    const shapes = editor.getSelectedShapes();
    const arrows = shapes.filter((s): s is TLArrowShape => s.type === "arrow");
    const boxes = shapes.filter(s => s.type === "diagram-box");
    const drawing = !shapes.length && editor.getCurrentToolId() === "arrow";
    if (!arrows.length && !boxes.length && !drawing) return null;
    return { arrows, boxes, drawing, next: nextLine(editor) };
  }, [editor]);
  const [styles, setStyles] = useState<LineStyle[]>(readStyles);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [open, setOpen] = useState(true);
  if (!editor || !state) return null;
  const { arrows, boxes, drawing } = state;
  const first = arrows[0];
  const line = first ? readLine(first.meta.line) : state.next;
  const shown = line ?? DEFAULT_LINE;
  const route = first ? (first.props.kind === "elbow" ? "elbow" : first.props.bend ? "curve" : "straight") : null;
  const change = (c: Partial<LineSpec>) => {
    if (arrows.length) applyLine(editor, arrows, c); else setNextLine(editor, { ...shown, ...c });
    onChange();
  };
  const allStyles = [...BUILT_IN_STYLES, ...styles];
  function pickStyle(id: string) {
    if (id === "__save") { setNaming(true); return; }
    const style = allStyles.find(s => s.id === id);
    if (!style || !editor) return;
    if (arrows.length) applyLine(editor, arrows, style.line);
    setNextLine(editor, style.line); // what you pick also applies to the next connector you draw
    onChange();
  }
  function saveStyle() {
    const entry: LineStyle = { id: crypto.randomUUID(), name: name.trim().slice(0, 60) || `Line style ${styles.length + 1}`, line: shown };
    const next = [...readStyles(), entry].slice(-30);
    try { localStorage.setItem(STYLES_KEY, JSON.stringify(next)); } catch { /* storage full or blocked: keep it for this visit */ }
    setStyles(next); setNaming(false); setName("");
  }
  function deleteStyle(id: string) {
    const next = readStyles().filter(s => s.id !== id);
    try { localStorage.setItem(STYLES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setStyles(next);
  }
  const box = boxes.length ? readBox(boxes[0].meta.box) : DEFAULT_BOX;

  return <section className="line-panel" aria-label="Line and box style" onPointerDown={e => e.stopPropagation()}>
    <button type="button" className="line-panel-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
      {arrows.length ? `Line${arrows.length > 1 ? `s (${arrows.length})` : ""}` : drawing ? "Next line" : "Box"}{arrows.length && boxes.length ? ` + box${boxes.length > 1 ? "es" : ""}` : ""}
    </button>
    {open && <>
      {(arrows.length > 0 || drawing) && <div className="line-panel-group">
        <LinePreview line={shown} />
        <div className="line-panel-row">
          <label className="line-panel-wide">Style<select value="" onChange={e => pickStyle(e.target.value)}>
            <option value="">{line ? "Apply a line style…" : "Board style (tldraw)"}</option>
            <optgroup label="Line styles">{BUILT_IN_STYLES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
            {styles.length > 0 && <optgroup label="My styles">{styles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>}
            <option value="__save">Save current as a style…</option>
          </select></label>
        </div>
        {naming && <form className="line-panel-save" onSubmit={e => { e.preventDefault(); saveStyle(); }}>
          <input autoFocus value={name} maxLength={60} placeholder="Style name, e.g. Site section" onChange={e => setName(e.target.value)} />
          <button type="submit" className="button">Save</button><button type="button" onClick={() => setNaming(false)}>Cancel</button>
        </form>}
        {route && <div className="line-panel-route" role="group" aria-label="Route">
          {(["straight", "elbow", "curve"] as const).map(r => <button key={r} type="button" aria-pressed={route === r} onClick={() => { applyRoute(editor, arrows, r); onChange(); }}>{r === "straight" ? "Straight" : r === "elbow" ? "Elbow" : "Curve"}</button>)}
        </div>}
        <LineControls line={shown} onChange={change} />
        {arrows.length > 0 && line && <button type="button" className="line-panel-link" onClick={() => { resetLine(editor, arrows); onChange(); }}>Use board style instead</button>}
        {drawing && state.next && <button type="button" className="line-panel-link" onClick={() => setNextLine(editor, null)}>Draw with board style instead</button>}
        {styles.length > 0 && <details className="line-panel-styles"><summary>My styles</summary>
          <ul>{styles.map(s => <li key={s.id}><span>{s.name}</span><button type="button" aria-label={`Delete style ${s.name}`} onClick={() => deleteStyle(s.id)}>×</button></li>)}</ul>
        </details>}
      </div>}
      {boxes.length > 0 && <div className="line-panel-group">
        <strong className="line-panel-heading">Box outline</strong>
        <div className="line-panel-row">
          <label>Weight<select value={box.weight} onChange={e => { applyBox(editor, boxes, { weight: Number(e.target.value) }); onChange(); }}>
            {[...new Set([...WEIGHTS, box.weight])].sort((a, b) => a - b).map(w => <option key={w} value={w}>{w} pt</option>)}
          </select></label>
          <label>Type<select value={box.pattern} onChange={e => { applyBox(editor, boxes, { pattern: e.target.value as BoxSpec["pattern"] }); onChange(); }}>
            {PATTERNS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select></label>
        </div>
        <div className="line-panel-colors" role="group" aria-label="Outline colour">
          {LINE_COLORS.map(c => <button key={c} type="button" aria-label={`Outline ${c}`} aria-pressed={box.color === c} style={{ background: c }} onClick={() => { applyBox(editor, boxes, { color: c }); onChange(); }} />)}
          <input type="color" aria-label="Custom outline colour" value={box.color} onChange={e => { applyBox(editor, boxes, { color: e.target.value }); onChange(); }} />
        </div>
        <div className="line-panel-row">
          <label>Corners<select value={box.corner} onChange={e => { applyBox(editor, boxes, { corner: e.target.value as BoxSpec["corner"], corners: null }); onChange(); }}>
            {CORNERS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select></label>
          <label>Corner size<select value={box.cut} onChange={e => { applyBox(editor, boxes, { cut: Number(e.target.value) }); onChange(); }}>
            {[...new Set([8, 16, 24, 40, 64, box.cut])].sort((a, b) => a - b).map(c => <option key={c} value={c}>{c}</option>)}
          </select></label>
        </div>
        <div className="line-panel-row">
          <label>Hatched border<select value={box.hatch} onChange={e => { applyBox(editor, boxes, { hatch: Number(e.target.value) }); onChange(); }}>
            {[...new Set([...HATCHES, box.hatch])].sort((a, b) => a - b).map(hh => <option key={hh} value={hh}>{hh ? `${hh} wide` : "None"}</option>)}
          </select></label>
          <label>Fill<select value={box.fill} onChange={e => { applyBox(editor, boxes, { fill: e.target.value }); onChange(); }}>
            {[...new Set([...BOX_FILLS, box.fill])].map(f => <option key={f} value={f}>{f === "none" ? "None" : f === "#ffffff" ? "White" : f === "#111111" ? "Black" : f === "#f4f3ef" ? "Paper" : f === "#e9e9e7" ? "Light grey" : f === "#d4f53c" ? "Signal green" : f === "#1f3a4d" ? "Navy" : f}</option>)}
          </select></label>
        </div>
        <div className="line-panel-quad" role="group" aria-label="Corner shapes">
          <span>Each corner</span>
          {["Top left", "Top right", "Bottom right", "Bottom left"].map((name, n) => {
            const kinds = cornerKinds(box.corner, box.corners);
            return <select key={name} aria-label={`${name} corner`} title={`${name} corner`} value={kinds[n]} onChange={e => { const next = [...kinds]; next[n] = e.target.value as typeof kinds[number]; applyBox(editor, boxes, { corners: next }); onChange(); }}>
              {CORNER_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>;
          })}
        </div>
        {box.hatch > 0 && <div className="line-panel-quad" role="group" aria-label="Hatched sides">
          <span>Hatch runs</span>
          {["Top", "Right", "Bottom", "Left"].map((name, n) => <select key={name} aria-label={`${name} side hatch`} title={`${name} side`} value={box.sides[n]} onChange={e => { const next = [...box.sides]; next[n] = e.target.value as typeof box.sides[number]; applyBox(editor, boxes, { sides: next }); onChange(); }}>
            {SIDE_HATCHES.map(k => <option key={k.id} value={k.id}>{name}: {sideLabel(n, k.id, k.label)}</option>)}
          </select>)}
        </div>}
        <label className="line-panel-wide">Drop shadow<select value={box.shadow} onChange={e => { applyBox(editor, boxes, { shadow: Number(e.target.value) }); onChange(); }}>
          {[...new Set([...SHADOWS, box.shadow])].sort((a, b) => a - b).map(sh => <option key={sh} value={sh}>{sh ? `${sh} offset` : "None"}</option>)}
        </select></label>
        <label className="line-panel-wide">Header band<select value={box.header} onChange={e => { applyBox(editor, boxes, { header: Number(e.target.value) }); onChange(); }}>
          {HEADERS.map(h => <option key={h.h} value={h.h}>{h.label}</option>)}
        </select></label>
        <small>Band colour comes from the colour picker in the style panel.</small>
      </div>}
    </>}
  </section>;
}
