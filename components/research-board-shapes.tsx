"use client";
/* eslint-disable @next/next/no-img-element -- Board thumbnails use authenticated reduced-size endpoints. */
import { createContext, memo, useContext, useState } from "react";
import { BaseBoxShapeUtil, FrameShapeUtil, HTMLContainer, T, resizeBox, useValue, type Editor, type TLEditStartInfo, type TLFrameShape, type TLResizeInfo, type TLShape } from "tldraw";
import { layoutCard, type CardInput, type TextStyle } from "@/lib/boards/card-svg";
import type { BoardRecord } from "@/lib/boards/layout";
import type { RecordShape } from "@/lib/boards/insertion";

export const BoardRecords = createContext<ReadonlyMap<string, BoardRecord>>(new Map());
// SVG export renders outside the board's React tree, so the canvas keeps this copy current.
let exportRecords: ReadonlyMap<string, BoardRecord> = new Map();
export function setExportRecords(records: ReadonlyMap<string, BoardRecord>) { exportRecords = records; }

function cardLabel(type: string) {
  return type === "document" ? "Document / source" : type === "theme" ? "Theme / linked" : type === "unavailable" ? "Unavailable record" : type;
}
export function cardInput(record: BoardRecord | undefined, shape: RecordShape, image?: string): CardInput {
  const type = record?.type || "unavailable";
  return {
    type, label: cardLabel(type), title: record?.title || "Source removed", compact: shape.props.compact, image,
    body: type === "note" ? record?.body || record?.subtitle : type === "theme" ? record?.subtitle : undefined,
    byline: record?.creator || (type === "document" ? record?.subtitle : undefined),
    detail: record?.detail,
  };
}
let measureContext: CanvasRenderingContext2D | null = null;
const cssFont = (s: TextStyle) => `${s.weight} ${s.size}px ${s.family}`;
export function measure(text: string, style: TextStyle) {
  measureContext ||= document.createElement("canvas").getContext("2d");
  if (!measureContext) return text.length * style.size * 0.55;
  measureContext.font = cssFont(style);
  return measureContext.measureText(text).width + style.letterSpacing * text.length;
}
/** Embed the card image so the SVG stands alone; JPEG keeps files small and opens everywhere. */
async function embedImage(url: string, w: number, h: number) {
  try {
    const response = await fetch(url, { credentials: "same-origin", referrerPolicy: "no-referrer" });
    if (!response.ok) throw new Error();
    const bitmap = await createImageBitmap(await response.blob());
    const scale = Math.min(1, (Math.max(w, h) * 2) / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error();
    ctx.fillStyle = "#efefeb"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return url; // Linked instead of embedded when the image host refuses a copy.
  }
}
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "card";
export function shapeRecordKey(shape: TLShape | null | undefined) {
  if (shape?.type === "research-record") return shape.props.recordKey;
  if (shape?.type === "frame" && typeof shape.meta.recordKey === "string") return shape.meta.recordKey;
  return undefined;
}
const RecordCard = memo(function RecordCard({ shape }: { shape: RecordShape }) {
  const record = useContext(BoardRecords).get(shape.props.recordKey);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const type = record?.type || "unavailable";
  const image = record?.image && failedImage !== record.image ? record.image : undefined;
  const compact = shape.props.compact;
  const body = type === "note" ? record?.body || record?.subtitle : type === "theme" ? record?.subtitle : undefined;
  const byline = record?.creator || (type === "document" ? record?.subtitle : undefined);
  return <HTMLContainer className={`research-board-card card-${type}${image ? " card-visual" : ""}${compact ? " card-compact" : ""}`} style={{ width: shape.props.w, height: shape.props.h }}>
    {image && <div className="board-card-image"><img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false} onError={() => setFailedImage(image)} /></div>}
    <div className="board-card-caption">
      <small>{type === "document" ? "Document / source" : type === "theme" ? "Theme / linked" : type === "unavailable" ? "Unavailable record" : type}</small>
      <strong>{record?.title || "Source removed"}</strong>
      {body ? <p className="board-card-body">{body}</p> : <>
        {!compact && byline && <p className="board-card-byline">{byline}</p>}
        {!compact && record?.detail && <p className="board-card-detail">{record.detail}</p>}
      </>}
    </div>
  </HTMLContainer>;
});
export class ResearchRecordUtil extends BaseBoxShapeUtil<RecordShape> {
  static override type = "research-record" as const;
  static override props = { w: T.number, h: T.number, recordKey: T.string, recordType: T.string.optional(), recordId: T.string.optional(), title: T.string.optional(), subtitle: T.string.optional(), image: T.string.optional(), compact: T.boolean.optional() };
  getDefaultProps() { return { w: 280, h: 160, recordKey: "" }; }
  override canEdit() { return false; }
  override onResize(shape: RecordShape, info: TLResizeInfo<RecordShape>) {
    return resizeBox(shape, info, { minWidth: 180, minHeight: shape.props.recordType === "theme" ? 64 : shape.props.image ? 160 : 104 });
  }
  override getAriaDescriptor(shape: RecordShape) { return shape.props.title || "Linked research record"; }
  component(shape: RecordShape) { return <RecordCard shape={shape} />; }
  override async toSvg(shape: RecordShape) {
    const record = exportRecords.get(shape.props.recordKey);
    const { w, h } = shape.props;
    const source = record?.image || shape.props.image;
    const layout = layoutCard(cardInput(record ?? (shape.props.title ? { key: shape.props.recordKey, id: "", type: shape.props.recordType || "unavailable", title: shape.props.title, subtitle: shape.props.subtitle || "", role: "visual", themeIds: [], topicIds: [], href: "" } : undefined), shape, source), w, h, measure);
    const image = layout.image && await embedImage(layout.image.href, layout.image.w, layout.image.h);
    const clip = `clip-${shape.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const name = `${slug(record?.title || shape.props.title || "card")}-${shape.id.slice(-6)}`;
    return <g id={name}>
      <defs><clipPath id={clip}><rect width={w} height={h} /></clipPath></defs>
      {layout.background && <rect width={w} height={h} fill={layout.background} />}
      <g clipPath={`url(#${clip})`}>
        {layout.image && image && <>
          <rect x={layout.image.x} y={layout.image.y} width={layout.image.w} height={layout.image.h} fill="#efefeb" />
          <image xlinkHref={image} x={layout.image.x} y={layout.image.y} width={layout.image.w} height={layout.image.h} preserveAspectRatio="xMidYMid meet" />
        </>}
        {layout.texts.map((t, i) => <text key={i} x={t.x} fontFamily={t.style.family} fontSize={t.style.size} fontWeight={t.style.weight} letterSpacing={t.style.letterSpacing || undefined} fill={t.color}>
          {t.lines.map((line, j) => <tspan key={j} x={t.x} y={t.y + j * t.lineHeight + (t.lineHeight - t.style.size) / 2 + t.style.size * 0.8}>{line}</tspan>)}
        </text>)}
      </g>
      {layout.border && (layout.border.topOnly
        ? <rect width={w} height={layout.border.width} fill={layout.border.color} />
        : <rect x={0.5} y={0.5} width={w - 1} height={h - 1} fill="none" stroke={layout.border.color} strokeWidth={1} />)}
    </g>;
  }
  getIndicatorPath(shape: RecordShape) { const path = new Path2D(); path.rect(0, 0, shape.props.w, shape.props.h); return path; }
}
class ResearchFrameUtil extends FrameShapeUtil {
  override canEdit(shape: TLFrameShape, info: TLEditStartInfo) {
    return !shape.meta.recordKey && super.canEdit(shape, info);
  }
}
// Retain native frame selection, grouping, movement and resizing; style only generated zones.
export const boardShapeUtils = [ResearchRecordUtil, ResearchFrameUtil.configure({
  getCustomDisplayValues: (_editor, shape) => shape.meta.boardZone ? {
    fillColor: "transparent", strokeColor: shape.meta.boardZone === "theme" ? "#c9c8c2" : "transparent",
    headingFillColor: "transparent", headingStrokeColor: "transparent", headingTextColor: "#66665e",
  } : {},
})];

export function BoardSourceActions({ editor, records }: { editor: Editor | null; records: ReadonlyMap<string, BoardRecord> }) {
  const key = useValue("selected research source", () => editor ? shapeRecordKey(editor.getOnlySelectedShape()) : undefined, [editor]);
  const record = key ? records.get(key) : undefined;
  return <div className="board-source-actions">
    <button className="button" disabled={!record} title={record ? `Open ${record.type}: ${record.title}` : "Select a research card or Theme frame"} onClick={() => { if (record) window.open(record.href, "_blank", "noopener,noreferrer"); }}>Open Source ↗</button>
    <button className="button" disabled={!record} title="Open source in this view" onClick={() => { if (record) window.location.assign(record.href); }}>In this view</button>
  </div>;
}
