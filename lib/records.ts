export const recordRoutes = {
  reference: { table: "references", label: "References", path: "/library/references" },
  media: { table: "media", label: "Images & documents", path: "/library/items/media" },
  note: { table: "notes", label: "Notes", path: "/library/items/note" },
  research_thread: { table: "research_threads", label: "Research topics", path: "/research" },
  project: { table: "projects", label: "Projects", path: "/projects" },
  collection: { table: "collections", label: "Collections", path: "/collections" },
  board: { table: "boards", label: "Boards", path: "/boards" },
} as const;
export type RecordKind = keyof typeof recordRoutes;
export function isRecordKind(kind: string): kind is RecordKind { return Object.hasOwn(recordRoutes, kind); }
export function recordHref(kind: RecordKind, id: string) { return `${recordRoutes[kind].path}/${encodeURIComponent(id)}`; }
export function searchPattern(text: string) {
  return `%${text.trim().slice(0, 120).replace(/[\\%_]/g, char => `\\${char}`)}%`;
}
