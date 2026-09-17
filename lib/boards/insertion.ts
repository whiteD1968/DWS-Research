import { createShapeId, loadSnapshot, type Editor, type TLBaseShape, type TLParentId, type TLShapeId, type TLStoreSnapshot } from "tldraw";
import type { BoardRecord, Composition } from "./layout";

export type ResearchRecordProps = {
  w: number; h: number; recordKey: string;
  // Optional so documents saved before these display hints remain loadable.
  recordType?: string; recordId?: string; title?: string; subtitle?: string; image?: string;
};
export type RecordShape = TLBaseShape<"research-record", ResearchRecordProps>;
declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap { "research-record": ResearchRecordProps }
}
type Position = { x: number; y: number; w?: number; h?: number; parentId?: TLParentId; id?: TLShapeId; select?: boolean };

/** All structured placements enter the active editor here. Coordinates are parent-local. */
export function insertResearchRecord(editor: Editor, record: BoardRecord, position?: Position) {
  if (editor.isDisposed || editor.getIsReadonly()) throw new Error("This board is not ready for editing.");
  const w = position?.w ?? 280, h = position?.h ?? 300;
  const center = editor.getViewportPageBounds().center;
  let x = position?.x ?? center.x - w / 2;
  let y = position?.y ?? center.y - h / 2;
  if (!position) {
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
      ...(record.image?.startsWith("/boards/thumbnail/") ? { image: record.image } : {}), w, h },
  });
  if (!editor.getShape(id)) throw new Error("The record could not be added. Check the board shape limit and try again.");
  if (position?.select !== false) { editor.setCurrentTool("select"); editor.select(id); }
  return id;
}

/** A saved document always wins, including a board deliberately emptied by its owner. */
export function initializeResearchBoard(editor: Editor, snapshot: unknown, composition: Composition | undefined, records: BoardRecord[]) {
  if (snapshot != null) { loadSnapshot(editor.store, { document: snapshot as TLStoreSnapshot }); return false; }
  if (!composition || editor.getCurrentPageShapeIds().size) return false;
  const catalog = new Map(records.map(record => [record.key, record]));
  const placements = composition.placements.map(p => {
    const record = catalog.get(p.key);
    if (!record || !composition.frames[p.frame]) throw new Error("A generated board source is unavailable.");
    return { ...p, record };
  });
  editor.run(() => {
    const frames = composition.frames.map(f => {
      const id = createShapeId();
      editor.createShape({ id, type: "frame", parentId: editor.getCurrentPageId(), x: f.x, y: f.y, props: { w: f.w, h: f.h, name: f.title } });
      return id;
    });
    for (const p of placements) insertResearchRecord(editor, p.record, { ...p, parentId: frames[p.frame], select: false });
  }, { history: "ignore" });
  return true;
}
