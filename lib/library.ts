// One shape for everything the Library holds, so images, documents, notes, and references share one feed.
export const libraryViews = ["all", "images", "documents", "notes", "references"] as const;
export type LibraryView = (typeof libraryViews)[number];
export type LibraryKind = Exclude<LibraryView, "all">;

export const libraryLabels: Record<LibraryView, string> = { all: "Everything", images: "Images", documents: "Documents", notes: "Notes", references: "References" };
export const libraryPageSize = 36;
export const libraryLayouts = ["grid", "compact", "list"] as const;
export type LibraryLayout = (typeof libraryLayouts)[number];
// Compact sheets show many more thumbnails per screen, so they page in larger steps.
export const pageSizeFor = (layout: LibraryLayout) => (layout === "compact" ? 120 : libraryPageSize);

export type LibraryState = { view: LibraryView; q?: string; layout?: LibraryLayout; tags?: string[]; within?: string; page?: number };

// Every library link is built here so filters, layout, and search survive each click.
export function libraryHref(state: LibraryState) {
  const params = new URLSearchParams();
  if (state.view !== "all") params.set("view", state.view);
  if (state.q) params.set("q", state.q);
  if (state.layout && state.layout !== "grid") params.set("layout", state.layout);
  if (state.tags?.length) params.set("tags", state.tags.join(","));
  if (state.within) params.set("in", state.within);
  if (state.page && state.page > 1) params.set("page", String(state.page));
  const query = params.toString();
  return query ? `/library?${query}` : "/library";
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && uuid.test(value);

export function parseLibraryLayout(value: string | undefined): LibraryLayout {
  return libraryLayouts.includes(value as LibraryLayout) ? (value as LibraryLayout) : "grid";
}

export function parseTagIds(value: string | undefined) {
  return [...new Set((value || "").split(",").filter(isUuid))].slice(0, 8);
}

export const withinKinds = ["project", "research_thread", "board"] as const;
export type WithinKind = (typeof withinKinds)[number];
export function parseWithin(value: string | undefined): { kind: WithinKind; id: string } | null {
  const [kind, id] = (value || "").split(":");
  return withinKinds.includes(kind as WithinKind) && isUuid(id) ? { kind: kind as WithinKind, id } : null;
}

// Ids matching every filter: each list narrows the previous one.
export function intersectIds(lists: string[][]) {
  if (!lists.length) return null;
  return lists.slice(1).reduce((kept, list) => { const next = new Set(list); return kept.filter(id => next.has(id)); }, [...new Set(lists[0])]);
}

export type LibraryEntry = {
  kind: LibraryKind;
  id: string;
  title: string;
  label: string;
  text: string;
  href: string;
  mediaId: string | null;
  thumbnail: string | null;
  altText: string;
  updatedAt: string;
  tags: { id: string; name: string }[];
};

type Row = Record<string, unknown>;
const str = (value: unknown) => (typeof value === "string" ? value : "");

export function parseLibraryView(value: string | undefined): LibraryView {
  return libraryViews.includes(value as LibraryView) ? (value as LibraryView) : "all";
}

// Supabase `or()` filters use commas and parentheses as syntax, so those are dropped along with LIKE wildcards.
export function libraryPattern(search: string) {
  const clean = search.replace(/[%_\\,()*"]/g, " ").trim().slice(0, 120);
  return clean ? `%${clean}%` : "";
}

export function mediaEntry(row: Row): LibraryEntry {
  const image = row.media_type === "image";
  return {
    kind: image ? "images" : "documents",
    id: str(row.id),
    title: str(row.title) || str(row.original_filename) || "Untitled",
    label: image ? "Image" : row.mime_type === "application/pdf" ? "PDF" : "Document",
    text: str(row.caption),
    href: `/library/items/media/${str(row.id)}`,
    mediaId: str(row.id),
    thumbnail: null,
    altText: str(row.alt_text) || str(row.title),
    updatedAt: str(row.updated_at),
    tags: [],
  };
}

export function noteEntry(row: Row): LibraryEntry {
  return { kind: "notes", id: str(row.id), title: str(row.title) || "Untitled note", label: "Note", text: str(row.plain_text), href: `/library/items/note/${str(row.id)}`, mediaId: null, thumbnail: null, altText: "", updatedAt: str(row.updated_at), tags: [] };
}

export function referenceEntry(row: Row, externalThumbnail?: string | null): LibraryEntry {
  const type = str(row.reference_type).replace(/_/g, " ") || "reference";
  const creator = str(row.creator);
  return {
    kind: "references",
    id: str(row.id),
    title: str(row.title) || "Untitled reference",
    label: creator ? `${type} · ${creator}` : type,
    text: str(row.why_saved) || str(row.description),
    href: `/library/references/${str(row.id)}`,
    mediaId: str(row.primary_media_id) || null,
    thumbnail: externalThumbnail ?? null,
    altText: str(row.title),
    updatedAt: str(row.updated_at),
    tags: [],
  };
}

// Newest first across every kind; ties keep a stable order so paging never repeats an item.
export function mergeEntries(groups: LibraryEntry[][], start: number, size: number) {
  return groups.flat().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)).slice(start, start + size);
}
