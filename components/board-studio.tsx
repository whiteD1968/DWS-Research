"use client";
import { useEffect, useRef } from "react";
import { BaseBoxShapeUtil, HTMLContainer, T, resizeBox, stopEventPropagation, useIsEditing, type Editor, type TLBaseShape, type TLResizeInfo } from "tldraw";
import { NUMERAL_STYLES, STUDIO_INKS, accentRuns, bracketPath, gridMarks, ink, nextRating, ratingCells, type NumeralStyle } from "@/lib/boards/studio";

type RatingProps = { w: number; h: number; label: string; value: number; max: number; ink: string };
type GridProps = { w: number; h: number; rows: number; cols: number; ink: string };
type NumeralProps = { w: number; h: number; text: string; style: string; ink: string };
type BracketProps = { w: number; h: number; arm: number; dashed: boolean; ink: string };
export type RatingShape = TLBaseShape<"rating-meter", RatingProps>;
export type GridShape = TLBaseShape<"study-grid", GridProps>;
export type NumeralShape = TLBaseShape<"numeral", NumeralProps>;
export type BracketShape = TLBaseShape<"corner-brackets", BracketProps>;
declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap { "rating-meter": RatingProps; "study-grid": GridProps; "numeral": NumeralProps; "corner-brackets": BracketProps }
}

const MONO = "'IBM Plex Mono', 'SFMono-Regular', Menlo, Consolas, monospace";
const HEAVY = "'Helvetica Neue', Arial, Helvetica, sans-serif";

function Inks({ value, onPick }: { value: string; onPick: (ink: string) => void }) {
  return <span className="studio-inks" onPointerDown={stopEventPropagation}>
    {STUDIO_INKS.map(i => <button key={i.id} type="button" aria-label={i.label} aria-pressed={value === i.id} style={{ background: i.id }} onClick={() => onPick(i.id)} />)}
  </span>;
}

// ---------- Rating meter ----------
function ratingSvg(p: RatingProps, accent = "#d4f53c") {
  const color = ink(p.ink);
  const { size, labelWidth, cells } = ratingCells(p.w, p.h, p.value, p.max);
  const font = Math.max(6, Math.min(p.h * 0.5, 16));
  const chars = Math.max(0, Math.floor(labelWidth / (font * 0.68)));
  const runs = accentRuns(p.label.toUpperCase(), chars);
  return <g>
    {runs.length > 0 && <text x={0} y={p.h / 2 + font * 0.36} fontFamily={MONO} fontSize={font} letterSpacing={font * 0.12} fill={color} xmlSpace="preserve">
      {runs.map((r, i) => <tspan key={i} fill={r.accent ? ink(accent, "#d4f53c") : color}>{r.text}</tspan>)}
    </text>}
    {cells.map((c, i) => <rect key={i} x={c.x} y={c.y} width={size} height={size} rx={size * 0.18} fill={color} fillOpacity={c.on ? 1 : 0.25} />)}
  </g>;
}
// The accent colour lives in meta, so boards saved before it existed still load unchanged.
const accentOf = (shape: RatingShape) => ink(shape.meta.accent, "#d4f53c");
function Rating({ shape, editor }: { shape: RatingShape; editor: Editor }) {
  const editing = useIsEditing(shape.id);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);
  const p = shape.props;
  const update = (props: Partial<RatingProps>) => editor.updateShape({ id: shape.id, type: "rating-meter", props });
  const { size, cells } = ratingCells(p.w, p.h, p.value, p.max);
  return <HTMLContainer style={{ width: p.w, height: p.h, pointerEvents: editing ? "all" : undefined }}>
    <svg width={p.w} height={p.h} style={{ overflow: "visible", display: "block" }} aria-label={`${p.label}: ${p.value} of ${p.max}`}>{ratingSvg(editing ? { ...p, label: "" } : p, accentOf(shape))}</svg>
    {editing && <>
      <input ref={input} className="studio-edit-label" value={p.label} placeholder="Quality — *D* for an accent letter" title="Wrap letters in asterisks to colour them, e.g. S *D*" aria-label="Rating label" onPointerDown={stopEventPropagation}
        style={{ width: Math.max(40, cells[0].x - 8), height: p.h }} onChange={e => update({ label: e.target.value.slice(0, 80) })} />
      {cells.map((c, i) => <button key={i} type="button" className="studio-rating-hit" aria-label={`Set to ${i + 1}`} onPointerDown={stopEventPropagation}
        style={{ left: c.x, top: c.y, width: size, height: size }} onClick={() => update({ value: nextRating(p.value, i + 1) })} />)}
      <div className="studio-edit-bar" onPointerDown={stopEventPropagation}>
        <label>Out of <select value={p.max} onChange={e => update({ max: Number(e.target.value), value: Math.min(p.value, Number(e.target.value)) })}>{[3, 4, 5, 6, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
        <Inks value={ink(p.ink)} onPick={v => update({ ink: v })} />
        <span>Accent</span>
        <Inks value={accentOf(shape)} onPick={v => editor.updateShape({ id: shape.id, type: "rating-meter", meta: { ...shape.meta, accent: v } })} />
      </div>
    </>}
  </HTMLContainer>;
}
/** A labelled n-of-5 rating, as on the studio's scorecards. Double-click to set the label and value. */
export class RatingMeterUtil extends BaseBoxShapeUtil<RatingShape> {
  static override type = "rating-meter" as const;
  static override props = { w: T.number, h: T.number, label: T.string, value: T.number, max: T.number, ink: T.string };
  getDefaultProps(): RatingProps { return { w: 280, h: 22, label: "Quality", value: 3, max: 5, ink: "#111111" }; }
  override canEdit() { return true; }
  override onResize(shape: RatingShape, info: TLResizeInfo<RatingShape>) { return resizeBox(shape, info, { minWidth: 60, minHeight: 8 }); }
  override getAriaDescriptor(shape: RatingShape) { return `${shape.props.label}: ${shape.props.value} of ${shape.props.max}`; }
  component(shape: RatingShape) { return <Rating shape={shape} editor={this.editor} />; }
  getIndicatorPath(shape: RatingShape) { const path = new Path2D(); path.rect(0, 0, shape.props.w, shape.props.h); return path; }
  override toSvg(shape: RatingShape) { return ratingSvg(shape.props, accentOf(shape)); }
}

// ---------- Study grid ----------
function gridSvg(p: GridProps) {
  const color = ink(p.ink, "#9a9c95");
  const m = gridMarks(p.w, p.h, p.rows, p.cols);
  const k = Math.max(5, Math.min(12, Math.min(p.w / m.cols, p.h / m.rows) * 0.08));
  const dash = { stroke: color, strokeWidth: 0.6, strokeDasharray: "3 4", opacity: 0.7 };
  const solid = { stroke: color, strokeWidth: 1.1 };
  return <g>
    {m.xs.slice(1, -1).map((x, i) => <line key={`v${i}`} x1={x} y1={0} x2={x} y2={p.h} {...dash} />)}
    {m.ys.slice(1, -1).map((y, i) => <line key={`h${i}`} x1={0} y1={y} x2={p.w} y2={y} {...dash} />)}
    {m.crosses.map((c, i) => <path key={`c${i}`} d={`M${c.x - k},${c.y} H${c.x + k} M${c.x},${c.y - k} V${c.y + k}`} {...solid} />)}
    {m.ticks.map((t, i) => <path key={`t${i}`} {...solid} d={
      t.side === "top" ? `M${t.x - k},${t.y} H${t.x + k} M${t.x},${t.y} V${t.y + k}`
        : t.side === "bottom" ? `M${t.x - k},${t.y} H${t.x + k} M${t.x},${t.y} V${t.y - k}`
          : t.side === "left" ? `M${t.x},${t.y - k} V${t.y + k} M${t.x},${t.y} H${t.x + k}`
            : `M${t.x},${t.y - k} V${t.y + k} M${t.x},${t.y} H${t.x - k}`} />)}
  </g>;
}
function Grid({ shape, editor }: { shape: GridShape; editor: Editor }) {
  const editing = useIsEditing(shape.id);
  const p = shape.props;
  const update = (props: Partial<GridProps>) => editor.updateShape({ id: shape.id, type: "study-grid", props });
  return <HTMLContainer style={{ width: p.w, height: p.h, pointerEvents: editing ? "all" : undefined }}>
    <svg width={p.w} height={p.h} style={{ overflow: "visible", display: "block" }} aria-hidden="true">{gridSvg(p)}</svg>
    {editing && <div className="studio-edit-bar" onPointerDown={stopEventPropagation}>
      <label>Rows <input type="number" min={1} max={20} value={p.rows} onChange={e => update({ rows: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} /></label>
      <label>Columns <input type="number" min={1} max={20} value={p.cols} onChange={e => update({ cols: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} /></label>
      <Inks value={ink(p.ink, "#9a9c95")} onPick={v => update({ ink: v })} />
    </div>}
  </HTMLContainer>;
}
/** Dashed study cells with + registration marks, for iteration matrices. Double-click to set rows and columns. */
export class StudyGridUtil extends BaseBoxShapeUtil<GridShape> {
  static override type = "study-grid" as const;
  static override props = { w: T.number, h: T.number, rows: T.number, cols: T.number, ink: T.string };
  getDefaultProps(): GridProps { return { w: 1350, h: 450, rows: 3, cols: 9, ink: "#9a9c95" }; }
  override canEdit() { return true; }
  override getAriaDescriptor(shape: GridShape) { return `Study grid, ${shape.props.rows} by ${shape.props.cols}`; }
  component(shape: GridShape) { return <Grid shape={shape} editor={this.editor} />; }
  getIndicatorPath(shape: GridShape) { const path = new Path2D(); path.rect(0, 0, shape.props.w, shape.props.h); return path; }
  override toSvg(shape: GridShape) { return gridSvg(shape.props); }
}

// ---------- Numeral ----------
function numeralSvg(id: string, p: NumeralProps) {
  const color = ink(p.ink);
  const style = (NUMERAL_STYLES.some(s => s.id === p.style) ? p.style : "hatch") as NumeralStyle;
  const key = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const size = p.h * 1.08;
  return <g>
    {style === "hatch" && <defs><pattern id={`num-${key}`} width={Math.max(3, size / 22)} height={Math.max(3, size / 22)} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1={0} y1={0} x2={0} y2={Math.max(3, size / 22)} stroke={color} strokeWidth={Math.max(1, size / 60)} />
    </pattern></defs>}
    <text x={0} y={p.h * 0.88} fontFamily={HEAVY} fontWeight={800} fontSize={size} textLength={p.w} lengthAdjust="spacingAndGlyphs"
      fill={style === "solid" ? color : style === "hatch" ? `url(#num-${key})` : "none"} stroke={style === "solid" ? "none" : color} strokeWidth={Math.max(1, size / 70)}>{p.text}</text>
  </g>;
}
function Numeral({ shape, editor }: { shape: NumeralShape; editor: Editor }) {
  const editing = useIsEditing(shape.id);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) input.current?.select(); }, [editing]);
  const p = shape.props;
  const update = (props: Partial<NumeralProps>) => editor.updateShape({ id: shape.id, type: "numeral", props });
  return <HTMLContainer style={{ width: p.w, height: p.h, pointerEvents: editing ? "all" : undefined }}>
    <svg width={p.w} height={p.h} style={{ overflow: "visible", display: "block" }} aria-label={p.text}>{numeralSvg(shape.id, p)}</svg>
    {editing && <div className="studio-edit-bar" onPointerDown={stopEventPropagation}>
      <input ref={input} value={p.text} maxLength={6} aria-label="Numeral" style={{ width: 64 }} onChange={e => update({ text: e.target.value.slice(0, 6) })} />
      <select value={p.style} aria-label="Numeral style" onChange={e => update({ style: e.target.value })}>{NUMERAL_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
      <Inks value={ink(p.ink)} onPick={v => update({ ink: v })} />
    </div>}
  </HTMLContainer>;
}
/** Big section and sequence numbers — hatched, outlined or solid. Double-click to edit. */
export class NumeralUtil extends BaseBoxShapeUtil<NumeralShape> {
  static override type = "numeral" as const;
  static override props = { w: T.number, h: T.number, text: T.string, style: T.string, ink: T.string };
  getDefaultProps(): NumeralProps { return { w: 180, h: 140, text: "01", style: "hatch", ink: "#111111" }; }
  override canEdit() { return true; }
  override getAriaDescriptor(shape: NumeralShape) { return `Numeral ${shape.props.text}`; }
  component(shape: NumeralShape) { return <Numeral shape={shape} editor={this.editor} />; }
  getIndicatorPath(shape: NumeralShape) { const path = new Path2D(); path.rect(0, 0, shape.props.w, shape.props.h); return path; }
  override toSvg(shape: NumeralShape) { return numeralSvg(`x${shape.id}`, shape.props); }
}

// ---------- Corner brackets ----------
function bracketSvg(p: BracketProps) {
  return <path d={bracketPath(p.w, p.h, p.arm)} fill="none" stroke={ink(p.ink, "#c2413a")} strokeWidth={1.5} strokeDasharray={p.dashed ? "4 3" : undefined} strokeLinecap="butt" />;
}
function Brackets({ shape, editor }: { shape: BracketShape; editor: Editor }) {
  const editing = useIsEditing(shape.id);
  const p = shape.props;
  const update = (props: Partial<BracketProps>) => editor.updateShape({ id: shape.id, type: "corner-brackets", props });
  return <HTMLContainer style={{ width: p.w, height: p.h, pointerEvents: editing ? "all" : undefined }}>
    <svg width={p.w} height={p.h} style={{ overflow: "visible", display: "block" }} aria-hidden="true">{bracketSvg(p)}</svg>
    {editing && <div className="studio-edit-bar" onPointerDown={stopEventPropagation}>
      <label>Arm <select value={p.arm} onChange={e => update({ arm: Number(e.target.value) })}>{[...new Set([8, 14, 24, 40, p.arm])].sort((a, b) => a - b).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
      <label><input type="checkbox" checked={p.dashed} onChange={e => update({ dashed: e.target.checked })} /> Dashed</label>
      <Inks value={ink(p.ink, "#c2413a")} onPick={v => update({ ink: v })} />
    </div>}
  </HTMLContainer>;
}
/** Corner marks that frame a title, caption or image, as on the studio's boards. Double-click to edit. */
export class CornerBracketsUtil extends BaseBoxShapeUtil<BracketShape> {
  static override type = "corner-brackets" as const;
  static override props = { w: T.number, h: T.number, arm: T.number, dashed: T.boolean, ink: T.string };
  getDefaultProps(): BracketProps { return { w: 240, h: 120, arm: 14, dashed: true, ink: "#c2413a" }; }
  override canEdit() { return true; }
  override getAriaDescriptor() { return "Corner brackets"; }
  component(shape: BracketShape) { return <Brackets shape={shape} editor={this.editor} />; }
  getIndicatorPath(shape: BracketShape) { const path = new Path2D(); path.rect(0, 0, shape.props.w, shape.props.h); return path; }
  override toSvg(shape: BracketShape) { return bracketSvg(shape.props); }
}

export const studioShapeUtils = [RatingMeterUtil, StudyGridUtil, NumeralUtil, CornerBracketsUtil];
