"use client";
import { useEffect, useRef } from "react";
import {
  ArrowShapeArrowheadEndStyle, ArrowShapeArrowheadStartStyle, ArrowShapeKindStyle, BaseBoxShapeUtil, DefaultColorStyle, DefaultDashStyle, DefaultSizeStyle,
  HTMLContainer, T, createShapeId, resizeBox, stopEventPropagation, useIsEditing, useValue,
  type Editor, type TLArrowShape, type TLBaseShape, type TLDefaultColorStyle, type TLResizeInfo, type TLShapeId,
} from "tldraw";
import { BOX_HEADER, CONNECTOR_PRESETS, boxColor, quickAddPosition, type Side } from "@/lib/boards/diagram";
import { wrapText, type TextStyle } from "@/lib/boards/card-svg";
import { measure } from "./research-board-shapes";
import { BUILT_IN_STYLES, PT, boxPath, cornerKinds, dashArray, hatchRuns, isDark, readBox, type BoxSpec } from "@/lib/boards/lines";
import { applyLine, setNextLine } from "./board-lines";

type DiagramBoxProps = { w: number; h: number; title: string; body: string; color: TLDefaultColorStyle };
export type DiagramBoxShape = TLBaseShape<"diagram-box", DiagramBoxProps>;
declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap { "diagram-box": DiagramBoxProps }
}

const TITLE: TextStyle = { family: "Arial, Helvetica, sans-serif", size: 13, weight: 700, letterSpacing: 0 };
const BODY: TextStyle = { family: "Arial, Helvetica, sans-serif", size: 12, weight: 400, letterSpacing: 0 };
const PAD = 10;

/**
 * Everything drawn behind a box's text: fill, header band, hatched border band and outline,
 * all following the same square, rounded or cut-corner outline. Shared by the canvas and SVG export.
 */
export function boxGraphic(id: string, w: number, h: number, box: BoxSpec, band: string) {
  const sw = box.weight * PT;
  const key = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const kinds = cornerKinds(box.corner, box.corners);
  const outer = boxPath(w, h, kinds, box.cut);
  const stroke = boxPath(w, h, kinds, box.cut, sw / 2);
  const partial = box.hatch > 0 && box.sides.some(s => s !== "full");
  return <>
    <defs>
      <clipPath id={`clip-${key}`}><path d={outer} /></clipPath>
      {box.hatch > 0 && <pattern id={`hatch-${key}`} width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={5} stroke={box.color} strokeWidth={1.4} />
      </pattern>}
      {partial && <clipPath id={`runs-${key}`}>{hatchRuns(w, h, box.hatch, box.sides).map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />)}</clipPath>}
    </defs>
    {box.shadow > 0 && <path d={outer} transform={`translate(${box.shadow} ${box.shadow})`} fill="#111111" />}
    {box.fill !== "none" && <path d={outer} fill={box.fill} />}
    {box.header > 0 && <rect width={w} height={box.header} fill={band} clipPath={`url(#clip-${key})`} />}
    {box.hatch > 0 && <path d={`${outer} ${boxPath(w, h, kinds, box.cut, box.hatch)}`} fillRule="evenodd" fill={`url(#hatch-${key})`} clipPath={partial ? `url(#runs-${key})` : undefined} />}
    <path d={stroke} fill="none" stroke={box.color} strokeWidth={sw} strokeDasharray={dashArray(box.pattern, box.weight)} strokeLinecap={box.pattern === "dotted" ? "round" : "butt"} strokeLinejoin="miter" />
  </>;
}

function DiagramBox({ shape, editor }: { shape: DiagramBoxShape; editor: Editor }) {
  const editing = useIsEditing(shape.id);
  const title = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) title.current?.focus(); }, [editing]);
  const { band, text } = boxColor(shape.props.color);
  const box = readBox(shape.meta.box);
  const titled = box.header >= BOX_HEADER;
  const ink = box.fill !== "none" && isDark(box.fill) ? "#f4f3ef" : undefined;
  const inset = box.hatch ? box.hatch + 4 : 0;
  const update = (props: Partial<DiagramBoxProps>) => editor.updateShape({ id: shape.id, type: "diagram-box", props });
  return <HTMLContainer className="diagram-box" style={{ width: shape.props.w, height: shape.props.h, color: ink, padding: inset, pointerEvents: editing ? "all" : undefined }}>
    <svg className="diagram-box-outline" width={shape.props.w} height={shape.props.h} aria-hidden="true">{boxGraphic(shape.id, shape.props.w, shape.props.h, box, band)}</svg>
    {box.header > 0 && <div className="diagram-box-band" style={{ color: text, height: box.header }}>
      {titled && (editing ? <input ref={title} value={shape.props.title} placeholder="Title" aria-label="Box title" style={{ color: text }}
        onPointerDown={stopEventPropagation} onChange={e => update({ title: e.target.value.slice(0, 200) })} />
        : <span>{shape.props.title}</span>)}
    </div>}
    {editing ? <textarea value={shape.props.body} placeholder="Details" aria-label="Box details" onPointerDown={stopEventPropagation} onChange={e => update({ body: e.target.value.slice(0, 4000) })} />
      : <p>{shape.props.body}</p>}
  </HTMLContainer>;
}

/** A box with a title band, for system, entity and process diagrams. Double-click to edit. */
export class DiagramBoxUtil extends BaseBoxShapeUtil<DiagramBoxShape> {
  static override type = "diagram-box" as const;
  static override props = { w: T.number, h: T.number, title: T.string, body: T.string, color: DefaultColorStyle };
  getDefaultProps(): DiagramBoxProps { return { w: 200, h: 140, title: "Title", body: "", color: "black" }; }
  override canEdit() { return true; }
  override onResize(shape: DiagramBoxShape, info: TLResizeInfo<DiagramBoxShape>) { return resizeBox(shape, info, { minWidth: 80, minHeight: BOX_HEADER + 20 }); }
  override getAriaDescriptor(shape: DiagramBoxShape) { return shape.props.title || "Diagram box"; }
  component(shape: DiagramBoxShape) { return <DiagramBox shape={shape} editor={this.editor} />; }
  getIndicatorPath(shape: DiagramBoxShape) { const path = new Path2D(); path.rect(0, 0, shape.props.w, shape.props.h); return path; }
  override toSvg(shape: DiagramBoxShape) {
    const { w, h, title, body } = shape.props;
    const { band, text } = boxColor(shape.props.color);
    const box = readBox(shape.meta.box);
    const header = box.header, titled = header >= BOX_HEADER;
    const inset = box.hatch ? box.hatch + 4 : 0;
    const ink = box.fill !== "none" && isDark(box.fill) ? "#f4f3ef" : "#292a27";
    const titleLine = titled ? wrapText(title, TITLE, w - PAD * 2 - inset * 2, 1, measure) : [];
    const bodyLines = body.split("\n").flatMap(p => p.trim() ? wrapText(p, BODY, w - PAD * 2 - inset * 2, 99, measure) : [""]);
    const room = Math.max(0, Math.floor((h - header - PAD - inset * 2) / 17.4));
    const lines = bodyLines.slice(0, room);
    return <g id={`box-${(title || "box").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}-${shape.id.slice(-6)}`}>
      {boxGraphic(`x${shape.id}`, w, h, box, band)}
      {titleLine.length > 0 && <text x={PAD + inset} y={inset + header / 2 + 4.5} fontFamily={TITLE.family} fontSize={TITLE.size} fontWeight={TITLE.weight} fill={text}>{titleLine[0]}</text>}
      {lines.length > 0 && <text x={PAD + inset} fontFamily={BODY.family} fontSize={BODY.size} fill={ink}>
        {lines.map((line, i) => <tspan key={i} x={PAD + inset} y={inset + header + PAD + 12 + i * 17.4}>{line}</tspan>)}
      </text>}
    </g>;
  }
}

function applyPreset(editor: Editor, id: string) {
  const style = BUILT_IN_STYLES.find(s => `line:${s.id}` === id);
  if (style) {
    // Precise line styles: thin drafting lines with exact weights, routed as elbows.
    editor.setStyleForNextShapes(ArrowShapeKindStyle, "elbow");
    setNextLine(editor, style.line);
    const arrows = editor.getSelectedShapes().filter((s): s is TLArrowShape => s.type === "arrow");
    if (arrows.length) applyLine(editor, arrows, style.line); else editor.setCurrentTool("arrow");
    return;
  }
  const preset = CONNECTOR_PRESETS.find(p => p.id === id);
  if (!preset) return;
  setNextLine(editor, null);
  editor.setStyleForNextShapes(ArrowShapeKindStyle, preset.kind);
  editor.setStyleForNextShapes(DefaultDashStyle, preset.dash);
  editor.setStyleForNextShapes(ArrowShapeArrowheadStartStyle, preset.start);
  editor.setStyleForNextShapes(ArrowShapeArrowheadEndStyle, preset.end);
  editor.setStyleForNextShapes(DefaultSizeStyle, preset.size);
  const arrows = editor.getSelectedShapes().filter((s): s is TLArrowShape => s.type === "arrow");
  if (arrows.length) {
    editor.markHistoryStoppingPoint("Connector style");
    editor.updateShapes(arrows.map(a => ({ id: a.id, type: "arrow" as const, meta: Object.fromEntries(Object.entries(a.meta).filter(([k]) => k !== "line")), props: { kind: preset.kind, dash: preset.dash, arrowheadStart: preset.start, arrowheadEnd: preset.end, size: preset.size, ...(preset.kind === "arc" ? { bend: 0 } : {}) } })));
  } else editor.setCurrentTool("arrow");
}

const STUDIO_PIECES = [
  { id: "studio:rating", type: "rating-meter", label: "Add rating meter", w: 280, h: 22 },
  { id: "studio:grid", type: "study-grid", label: "Add study grid (3 × 9)", w: 1350, h: 450 },
  { id: "studio:numeral", type: "numeral", label: "Add section numeral", w: 180, h: 140 },
  { id: "studio:brackets", type: "corner-brackets", label: "Add corner brackets", w: 240, h: 120 },
] as const;

/** Header menu: add a headed box, or choose how connectors look (applies to selected connectors too). */
export function DiagramTools({ editor, onChange }: { editor: Editor | null; onChange: () => void }) {
  function choose(value: string) {
    if (!editor || !value) return;
    if (value === "box" || value === "group") {
      const id = createShapeId();
      const c = editor.getViewportPageBounds().center;
      const group = value === "group";
      editor.markHistoryStoppingPoint(group ? "Add group outline" : "Add box");
      editor.createShape<DiagramBoxShape>({ id, type: "diagram-box", x: Math.round(c.x - (group ? 160 : 100)), y: Math.round(c.y - (group ? 100 : 70)),
        ...(group ? { props: { w: 320, h: 200, title: "Group", body: "", color: "black" }, meta: { box: { weight: 0.5, pattern: "dashed", color: "#3a3a37", header: 0 } } } : {}) });
      editor.select(id); editor.setCurrentTool("select");
    } else if (value === "pill") {
      const id = createShapeId();
      const c = editor.getViewportPageBounds().center;
      editor.markHistoryStoppingPoint("Add descriptor pill");
      editor.createShape<DiagramBoxShape>({ id, type: "diagram-box", x: Math.round(c.x - 110), y: Math.round(c.y - 30),
        props: { w: 220, h: 60, title: "", body: "DESCRIPTOR", color: "black" }, meta: { box: { weight: 0.75, pattern: "solid", color: "#111111", header: 0, corner: "chamfer", cut: 16, hatch: 6, fill: "#ffffff" } } });
      editor.select(id); editor.setCurrentTool("select");
    } else if (STUDIO_PIECES.some(p => p.id === value)) {
      const piece = STUDIO_PIECES.find(p => p.id === value)!;
      const id = createShapeId();
      const c = editor.getViewportPageBounds().center;
      editor.markHistoryStoppingPoint(piece.label);
      editor.createShape({ id, type: piece.type, x: Math.round(c.x - piece.w / 2), y: Math.round(c.y - piece.h / 2) } as Parameters<Editor["createShape"]>[0]);
      editor.select(id); editor.setCurrentTool("select");
    } else applyPreset(editor, value);
    editor.focus(); // keyboard shortcuts go back to the canvas, not the menu
    onChange();
  }
  return <select aria-label="Diagram tools" value="" disabled={!editor} onChange={e => choose(e.target.value)}>
    <option value="">Diagram…</option>
    <option value="box">Add headed box</option>
    <option value="group">Add dashed group outline</option>
    <optgroup label="Studio pieces">
      <option value="pill">Add hatched descriptor pill</option>
      {STUDIO_PIECES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
    </optgroup>
    <optgroup label="Precise line styles">{BUILT_IN_STYLES.map(s => <option key={s.id} value={`line:${s.id}`}>{s.name}</option>)}</optgroup>
    <optgroup label="Board connectors">{CONNECTOR_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</optgroup>
  </select>;
}

/** "+" handles around a selected headed box: add a connected box on that side. */
export function QuickAdd({ editor, onChange }: { editor: Editor | null; onChange: () => void }) {
  const target = useValue("quick add target", () => {
    if (!editor || editor.getEditingShapeId() || !editor.isIn("select.idle")) return null;
    const shape = editor.getOnlySelectedShape();
    if (shape?.type !== "diagram-box") return null;
    const b = editor.getShapePageBounds(shape);
    if (!b) return null;
    const a = editor.pageToViewport({ x: b.x, y: b.y }), z = editor.pageToViewport({ x: b.maxX, y: b.maxY });
    return { id: shape.id, rect: { left: a.x, top: a.y, right: z.x, bottom: z.y } };
  }, [editor]);
  if (!editor || !target) return null;
  const { left, top, right, bottom } = target.rect;
  const spots: [Side, number, number][] = [["top", (left + right) / 2, top - 22], ["right", right + 22, (top + bottom) / 2], ["bottom", (left + right) / 2, bottom + 22], ["left", left - 22, (top + bottom) / 2]];

  function add(side: Side) {
    if (!editor || !target) return;
    const source = editor.getShape(target.id as TLShapeId) as DiagramBoxShape | undefined;
    if (!source) return;
    const id = createShapeId(), arrow = createShapeId();
    const at = quickAddPosition({ x: source.x, y: source.y, w: source.props.w, h: source.props.h }, side);
    editor.markHistoryStoppingPoint("Add connected box");
    editor.run(() => {
      editor.createShape<DiagramBoxShape>({ id, type: "diagram-box", parentId: source.parentId, x: at.x, y: at.y, meta: source.meta.box ? { box: source.meta.box } : {}, props: { w: source.props.w, h: source.props.h, color: source.props.color, title: "New box", body: "" } });
      editor.createShape<TLArrowShape>({ id: arrow, type: "arrow", parentId: source.parentId, x: 0, y: 0, props: {
        kind: editor.getStyleForNextShape(ArrowShapeKindStyle), dash: editor.getStyleForNextShape(DefaultDashStyle),
        arrowheadStart: editor.getStyleForNextShape(ArrowShapeArrowheadStartStyle), arrowheadEnd: editor.getStyleForNextShape(ArrowShapeArrowheadEndStyle),
        color: editor.getStyleForNextShape(DefaultColorStyle), size: editor.getStyleForNextShape(DefaultSizeStyle), start: { x: 0, y: 0 }, end: { x: 1, y: 1 },
      } });
      const bind = (to: TLShapeId, terminal: "start" | "end") => editor.createBinding({ type: "arrow", fromId: arrow, toId: to, props: { terminal, normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false, snap: "none" } });
      bind(source.id, "start"); bind(id, "end");
    });
    editor.select(id);
    onChange();
  }
  return <>{spots.map(([side, x, y]) => <button key={side} type="button" className="diagram-quick-add" style={{ left: x, top: y }} title={`Add a connected box ${side === "top" ? "above" : side === "bottom" ? "below" : `to the ${side}`}`} aria-label={`Add connected box ${side}`} onPointerDown={stopEventPropagation} onClick={() => add(side)}>+</button>)}</>;
}
