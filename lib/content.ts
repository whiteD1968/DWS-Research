export const contentKinds = {
  project: { table: "projects", label: "project", destination: "/projects" },
  reference: { table: "references", label: "reference", destination: "/library/references" },
  collection: { table: "collections", label: "collection", destination: "/collections" },
  research_thread: { table: "research_threads", label: "research topic", destination: "/research" },
  board: { table: "boards", label: "board", destination: "/boards" },
  media: { table: "media", label: "file", destination: "/library?view=images" },
  note: { table: "notes", label: "note", destination: "/library?view=notes" },
  research_session: { table: "research_sessions", label: "search session", destination: "/discover" },
} as const;
export type ContentKind = keyof typeof contentKinds;
export function isContentKind(value: string): value is ContentKind { return Object.hasOwn(contentKinds, value); }
