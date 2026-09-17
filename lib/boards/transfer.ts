import { Box, type Editor } from "tldraw";
import { generateComposition, type BoardRecord } from "./layout";
import { insertResearchRecord } from "./insertion";
import type { BoardTransfer } from "./handoff";

/** The receipt and placements share the same saved document, making refresh retry-safe. */
export function applyBoardTransfer(editor: Editor, transfer: BoardTransfer, records: BoardRecord[]) {
  const page = editor.getCurrentPage();
  const receipts = Array.isArray(page.meta.boardTransfers) ? page.meta.boardTransfers.filter((id): id is string => typeof id === "string") : [];
  if (receipts.includes(transfer.id)) return false;
  const selected = transfer.keys.map(key => records.find(record => record.key === key));
  if (selected.some(record => !record)) throw new Error("Some selected references are no longer available. Return to the source and select again.");
  const shapes = editor.getCurrentPageShapes();
  const linkedCount = editor.store.allRecords().filter(r => r.typeName === "shape" && (r.type === "research-record" || (r.type === "frame" && typeof r.meta.recordKey === "string"))).length;
  if (linkedCount + selected.length > 500) throw new Error("This selection exceeds the board's 500-placement limit.");
  const bounds = shapes.map(s => editor.getShapePageBounds(s)).filter((b): b is Box => !!b);
  const left = bounds.length ? Box.Common(bounds).maxX + 64 : 0;
  const composition = generateComposition(selected as BoardRecord[], "contact_sheet");
  const ids: ReturnType<typeof insertResearchRecord>[] = [];
  editor.run(() => {
    for (const placement of composition.placements) {
      const record = selected.find(r => r!.key === placement.key)!;
      ids.push(insertResearchRecord(editor, record, { x: left + placement.x, y: placement.y, w: placement.w, h: placement.h, select: false, compact: true }));
    }
    editor.updatePage({ id: page.id, meta: { ...page.meta, boardTransfers: [...receipts, transfer.id] } });
  });
  editor.select(...ids);
  return true;
}
