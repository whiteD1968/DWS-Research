export type BoardDraft = { id: string; ownerId: string; boardId: string; revision: string; snapshot: unknown; savedAt: number; version: 1 };
let connection: Promise<IDBDatabase> | undefined;
function database() {
  return connection ||= new Promise((resolve, reject) => {
    const request = indexedDB.open("dws-board-drafts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts", { keyPath: "id" }).createIndex("board", ["ownerId", "boardId"]);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { connection = undefined; reject(request.error); };
    request.onblocked = () => reject(new Error("Draft storage is blocked by another tab."));
  });
}
export async function listDrafts(ownerId: string, boardId: string): Promise<BoardDraft[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction("drafts").objectStore("drafts").index("board").getAll([ownerId, boardId]);
    request.onsuccess = () => resolve((request.result as BoardDraft[]).sort((a, b) => b.savedAt - a.savedAt));
    request.onerror = () => reject(request.error);
  });
}
export async function writeDraft(draft: BoardDraft) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.objectStore("drafts").put(draft);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}
// Compare before removal: a completed network save must never erase newer local work.
export async function removeDraft(draft: BoardDraft) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    const store = tx.objectStore("drafts"); const request = store.get(draft.id);
    request.onsuccess = () => { const current = request.result as BoardDraft | undefined; if (current?.ownerId === draft.ownerId && current.boardId === draft.boardId && current.savedAt === draft.savedAt) store.delete(draft.id); };
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}
export function draftMatchesServer(draft: BoardDraft, snapshot: unknown) {
  // Postgres JSONB can reorder object keys; an acknowledged save must not appear unsaved.
  const canonical = (value: unknown) => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
  return canonical(draft.snapshot) === canonical(snapshot);
}

/** Serialize disk writes and acknowledge only this editing session's saved document. */
export class DraftJournal {
  private queue: Promise<void> = Promise.resolve();
  private current?: BoardDraft;
  private writtenAt = 0;
  constructor(private ownerId: string, private boardId: string, private id: string, private failure: () => void, private storage = { write: writeDraft, remove: removeDraft }) {}
  private enqueue(work: () => Promise<void>) { this.queue = this.queue.then(work).catch(() => { this.failure(); }); }
  write(snapshot: unknown, revision: string) {
    const draft: BoardDraft = { id: this.id, ownerId: this.ownerId, boardId: this.boardId, revision, snapshot, savedAt: Math.max(Date.now(), (this.current?.savedAt || 0) + 1), version: 1 };
    this.current = draft; this.enqueue(async () => { await this.storage.write(draft); this.writtenAt = draft.savedAt; });
  }
  acknowledge(snapshot: unknown, revision: string) {
    const current = this.current;
    if (!current) return;
    if (current.snapshot === snapshot) { this.current = undefined; this.enqueue(() => this.storage.remove(current)); }
    else this.write(current.snapshot, revision);
  }
  settled() { return this.queue; }
  isDurable() { return !!this.current && this.writtenAt === this.current.savedAt; }
}
