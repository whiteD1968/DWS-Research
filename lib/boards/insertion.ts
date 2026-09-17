import { Box, createShapeId, loadSnapshot, type Editor, type TLBaseShape, type TLParentId, type TLShapeId, type TLFrameShape, type TLStoreSnapshot } from "tldraw";
import { cardSize, type BoardRecord, type Composition } from "./layout";

export type ResearchRecordProps = {
  w: number; h: number; recordKey: string;
  // Optional so documents saved before these display hints remain loadable.
  recordType?: string; recordId?: string; title?: string; subtitle?: string; image?: string; compact?: boolean;
};
export type RecordShape = TLBaseShape<"research-record", ResearchRecordProps>;
declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap { "research-record": ResearchRecordProps }
}
type Position = { x: number; y: number; w?: number; h?: number; parentId?: TLParentId; id?: TLShapeId; select?: boolean; compact?: boolean };

/** All structured placements enter the active editor here. Coordinates are parent-local. */
export function insertResearchRecord(editor: Editor, record: BoardRecord, position?: Position) {
  if (editor.isDisposed || editor.getIsReadonly()) throw new Error("This board is not ready for editing.");
  const size = cardSize(record, position?.compact);
  const w = position?.w ?? size.w, h = position?.h ?? size.h;
  const viewport = editor.getViewportPageBounds();
  const center = viewport.center;
  let x = position?.x ?? center.x - w / 2;
  let y = position?.y ?? center.y - h / 2;
  if (!position) {
    const selected = editor.getOnlySelectedShape();
    const selectedBounds = selected && selected.type !== "frame" ? editor.getShapePageBounds(selected) : undefined;
    if (selectedBounds && viewport.collides(selectedBounds)) { x = selectedBounds.x + 28; y = selectedBounds.y + 28; }
    // Find the first nearby unoccupied origin, including after a reload.
    const bounds = editor.getCurrentPageShapes().map(shape => editor.getShapePageBounds(shape));
    while (bounds.some(b => b && Math.abs(b.x - x) < 1 && Math.abs(b.y - y) < 1)) { x += 24; y += 24; }
  }
  const id = position?.id ?? createShapeId();
  editor.createShape<RecordShape>({ id, type: "research-record", x, y,
    // Avoid implicit frame parenting/clipping for viewport-centered additions.
    parentId: position?.parentId ?? editor.getCurrentPageId(),
    props: { recordKey: record.key, recordType: record.type, recordId: record.id,
      title: record.title, subtitle: record.subtitle,
      ...(record.image?.startsWith("/boards/thumbnail/") ? { image: record.image } : {}), ...(position?.compact ? { compact: true } : {}), w, h },
  });
  if (!editor.getShape(id)) throw new Error("The record could not be added. Check the board shape limit and try again.");
  if (position?.select !== false) { editor.setCurrentTool("select"); editor.select(id); editor.zoomToSelectionIfOffscreen(32, { animation: { duration: 160 }, targetZoom: Math.min(editor.getZoomLevel(), 1) }); }
  return id;
}

/** A saved document always wins, including a board deliberately emptied by its owner. */
export function initializeResearchBoard(editor: Editor, snapshot: unknown, composition: Composition | undefined, records: BoardRecord[]) {
  if (snapshot != null) {
    loadSnapshot(editor.store, { document: snapshot as TLStoreSnapshot });
    // Frame labels are display hints; the live Theme source remains authoritative.
    const catalog = new Map(records.map(r => [r.key, r]));
    editor.updateShapes<TLFrameShape>(editor.getCurrentPageShapes().filter((s): s is TLFrameShape => s.type === "frame" && typeof s.meta.recordKey === "string").map(s => ({ id: s.id, type: "frame", props: { name: catalog.get(s.meta.recordKey as string)?.title || "Unavailable theme" } })));
    return false;
  }
  if (!composition || editor.getCurrentPageShapeIds().size) return false;
  const catalog = new Map(records.map(record => [record.key, record]));
  for (const frame of composition.frames) if (frame.recordKey && !catalog.has(frame.recordKey)) throw new Error("A generated Theme source is unavailable.");
  const placements = composition.placements.map(p => {
    const record = catalog.get(p.key);
    if (!record || !composition.frames[p.frame]) throw new Error("A generated board source is unavailable.");
    return { ...p, record };
  });
  editor.run(() => {
    const frames = composition.frames.map(f => {
      const id = createShapeId();
      editor.createShape({ id, type: "frame", parentId: editor.getCurrentPageId(), x: f.x, y: f.y, props: { w: f.w, h: f.h, name: f.title }, meta: { ...(f.kind ? { boardZone: f.kind } : {}), ...(f.recordKey ? { recordKey: f.recordKey } : {}) } });
      return id;
    });
    for (const p of placements) insertResearchRecord(editor, p.record, { ...p, parentId: frames[p.frame], select: false });
  }, { history: "ignore" });
  return true;
}


/** Fit small boards fully; keep large pin-up walls readable and start at their upper-left. */
export function fitResearchBoard(editor: Editor, overview = false) {
  const bounds = editor.getCurrentPageShapes().map(s => editor.getShapePageBounds(s)).filter((b): b is Box => !!b);
  if (!bounds.length) return;
  const content = Box.Common(bounds);
  editor.zoomToBounds(content, { inset: 128, targetZoom: 1, animation: { duration: 0 } });
  if (!overview && editor.getZoomLevel() < 0.45) {
    editor.setCamera({ x: -content.x + 48 / 0.45, y: -content.y + 80 / 0.45, z: 0.45 });
  }
}
