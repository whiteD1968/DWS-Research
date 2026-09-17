"use client";
/* eslint-disable @next/next/no-img-element -- Board thumbnails use authenticated reduced-size endpoints. */
import { createContext, memo, useContext, useState } from "react";
import { BaseBoxShapeUtil, FrameShapeUtil, HTMLContainer, T, resizeBox, useValue, type Editor, type TLEditStartInfo, type TLFrameShape, type TLResizeInfo, type TLShape } from "tldraw";
import type { BoardRecord } from "@/lib/boards/layout";
import type { RecordShape } from "@/lib/boards/insertion";

export const BoardRecords = createContext<ReadonlyMap<string, BoardRecord>>(new Map());
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
    {image && <div className="board-card-image"><img src={image} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailedImage(image)} /></div>}
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
