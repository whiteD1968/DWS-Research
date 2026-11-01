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

type DiagramBoxProps = { w: number; h: number; title: string; body: string; color: TLDefaultColorStyle };
export type DiagramBoxShape = TLBaseShape<"diagram-box", DiagramBoxProps>;
declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap { "diagram-box": DiagramBoxProps }
}

const TITLE: TextStyle = { family: "Arial, Helvetica, sans-serif", size: 13, weight: 700, letterSpacing: 0 };
const BODY: TextStyle = { family: "Arial, Helvetica, sans-serif", size: 12, weight: 400, letterSpacing: 0 };
const PAD = 10;

function DiagramBox({ shape, editor }: { shape: DiagramBoxShape; editor: Editor }) {
  const editing = useIsEditing(shape.id);
  const title = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) title.current?.focus(); }, [editing]);
  const { band, text } = boxColor(shape.props.color);
  const update = (props: Partial<DiagramBoxProps>) => editor.updateShape({ id: shape.id, type: "diagram-box", props });
  return <HTMLContainer className="diagram-box" style={{ width: shape.props.w, height: shape.props.h, pointerEvents: editing ? "all" : undefined }}>
    <div className="diagram-box-band" style={{ background: band, color: text, height: BOX_HEADER }}>
      {editing ? <input ref={title} value={shape.props.title} placeholder="Title" aria-label="Box title" style={{ color: text }}
        onPointerDown={stopEventPropagation} onChange={e => update({ title: e.target.value.slice(0, 200) })} />
        : <span>{shape.props.title}</span>}
    </div>
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
    const titleLine = wrapText(title, TITLE, w - PAD * 2, 1, measure);
    const bodyLines = body.split("\n").flatMap(p => p.trim() ? wrapText(p, BODY, w - PAD * 2, 99, measure) : [""]);
    const room = Math.max(0, Math.floor((h - BOX_HEADER - PAD) / 17.4));
    const lines = bodyLines.slice(0, room);
    return <g id={`box-${(title || "box").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}-${shape.id.slice(-6)}`}>
      <rect x={0.5} y={0.5} width={w - 1} height={h - 1} fill="#ffffff" stroke="#3a3a37" strokeWidth={1} />
      <rect width={w} height={BOX_HEADER} fill={band} stroke={shape.props.color === "white" ? "#3a3a37" : "none"} />
      {titleLine.length > 0 && <text x={PAD} y={BOX_HEADER / 2 + 4.5} fontFamily={TITLE.family} fontSize={TITLE.size} fontWeight={TITLE.weight} fill={text}>{titleLine[0]}</text>}
      {lines.length > 0 && <text x={PAD} fontFamily={BODY.family} fontSize={BODY.size} fill="#292a27">
        {lines.map((line, i) => <tspan key={i} x={PAD} y={BOX_HEADER + PAD + 12 + i * 17.4}>{line}</tspan>)}
      </text>}
    </g>;
  }
}

function applyPreset(editor: Editor, id: string) {
  const preset = CONNECTOR_PRESETS.find(p => p.id === id);
  if (!preset) return;
  editor.setStyleForNextShapes(ArrowShapeKindStyle, preset.kind);
  editor.setStyleForNextShapes(DefaultDashStyle, preset.dash);
  editor.setStyleForNextShapes(ArrowShapeArrowheadStartStyle, preset.start);
  editor.setStyleForNextShapes(ArrowShapeArrowheadEndStyle, preset.end);
  editor.setStyleForNextShapes(DefaultSizeStyle, preset.size);
  const arrows = editor.getSelectedShapes().filter((s): s is TLArrowShape => s.type === "arrow");
  if (arrows.length) {
    editor.markHistoryStoppingPoint("Connector style");
    editor.updateShapes(arrows.map(a => ({ id: a.id, type: "arrow" as const, props: { kind: preset.kind, dash: preset.dash, arrowheadStart: preset.start, arrowheadEnd: preset.end, size: preset.size, ...(preset.kind === "arc" ? { bend: 0 } : {}) } })));
  } else editor.setCurrentTool("arrow");
}

/** Header menu: add a headed box, or choose how connectors look (applies to selected connectors too). */
export function DiagramTools({ editor, onChange }: { editor: Editor | null; onChange: () => void }) {
  function choose(value: string) {
    if (!editor || !value) return;
    if (value === "box") {
      const id = createShapeId();
      const c = editor.getViewportPageBounds().center;
      editor.markHistoryStoppingPoint("Add box");
      editor.createShape<DiagramBoxShape>({ id, type: "diagram-box", x: Math.round(c.x - 100), y: Math.round(c.y - 70) });
      editor.select(id); editor.setCurrentTool("select");
    } else applyPreset(editor, value);
    editor.focus(); // keyboard shortcuts go back to the canvas, not the menu
    onChange();
  }
  return <select aria-label="Diagram tools" value="" disabled={!editor} onChange={e => choose(e.target.value)}>
    <option value="">Diagram…</option>
    <option value="box">Add headed box</option>
    <optgroup label="Connector style">{CONNECTOR_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</optgroup>
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
      editor.createShape<DiagramBoxShape>({ id, type: "diagram-box", parentId: source.parentId, x: at.x, y: at.y, props: { w: source.props.w, h: source.props.h, color: source.props.color, title: "New box", body: "" } });
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
