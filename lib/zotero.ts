// Maps Zotero Web API items onto the site's sources and references. Pure, so the sync rules stay testable.

export const zoteroParent = "zotero_settings";
export const zoteroPageSize = 100;
// One sync imports at most this many changed items; the next run picks up where it stopped.
export const zoteroMaxPerRun = 1000;

export function parseZoteroUserId(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^\d{1,12}$/.test(text) ? text : "";
}
export function parseZoteroKey(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9]{24}$/.test(text) ? text : "";
}
export function parseCollectionKey(value: unknown) {
  const text = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z0-9]{8}$/.test(text) ? text : "";
}

export type ZoteroSettings = { userId: string; apiKey: string; collection: string; version: number; resumeStart: number; lastSync: string; lastError: string; imported: number };
export function zoteroSettingsFrom(meta: unknown): ZoteroSettings {
  const m = (meta || {}) as Record<string, unknown>;
  const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);
  return { userId: parseZoteroUserId(m.user_id), apiKey: parseZoteroKey(m.api_key), collection: parseCollectionKey(m.collection), version: count(m.version), resumeStart: count(m.resume_start), lastSync: typeof m.last_sync === "string" ? m.last_sync : "", lastError: typeof m.last_error === "string" ? m.last_error : "", imported: count(m.imported) };
}

// Top-level items changed since the last library version, oldest first so a capped run resumes cleanly.
export function itemsUrl(settings: Pick<ZoteroSettings, "userId" | "collection">, since: number, start: number) {
  const base = `https://api.zotero.org/users/${settings.userId}${settings.collection ? `/collections/${settings.collection}` : ""}/items/top`;
  const query = new URLSearchParams({ format: "json", since: String(since), start: String(start), limit: String(zoteroPageSize), sort: "dateModified", direction: "asc" });
  return `${base}?${query}`;
}

type Creator = { creatorType?: string; firstName?: string; lastName?: string; name?: string };
export type ZoteroItem = { key?: string; version?: number; data?: { key?: string; itemType?: string; title?: string; creators?: Creator[]; date?: string; url?: string; DOI?: string; ISBN?: string; publicationTitle?: string; bookTitle?: string; publisher?: string; place?: string; abstractNote?: string; tags?: { tag?: string }[]; parentItem?: string; deleted?: boolean } };

const skipTypes = new Set(["attachment", "note", "annotation"]);
const typeMap: Record<string, string> = {
  book: "book", bookSection: "book_chapter", journalArticle: "article", magazineArticle: "article", newspaperArticle: "article",
  report: "report", thesis: "thesis", webpage: "website", blogPost: "website", artwork: "image", map: "drawing",
  conferencePaper: "paper", preprint: "paper", manuscript: "document", document: "document",
};

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

export function creatorsLabel(creators: Creator[] = []) {
  const authors = creators.filter(creator => !creator.creatorType || creator.creatorType === "author" || creator.creatorType === "artist" || creator.creatorType === "editor");
  const names = (authors.length ? authors : creators).map(creator => clean(creator.name, 120) || [clean(creator.firstName, 80), clean(creator.lastName, 80)].filter(Boolean).join(" ")).filter(Boolean);
  if (!names.length) return "";
  return names.length > 3 ? `${names[0]} et al.` : names.length === 3 ? `${names[0]}, ${names[1]}, and ${names[2]}` : names.join(" and ");
}

export function zoteroYear(date: unknown) {
  const match = typeof date === "string" ? date.match(/\b(1[5-9]\d\d|20\d\d|21\d\d)\b/) : null;
  return match ? match[1] : "";
}

export function zoteroRecord(item: ZoteroItem) {
  const data = item.data || {};
  const key = clean(data.key || item.key, 16);
  if (!key || !data.itemType || skipTypes.has(data.itemType) || data.parentItem || data.deleted) return null;
  const title = clean(data.title, 500) || "Untitled Zotero item";
  const creator = creatorsLabel(data.creators);
  const url = /^https?:\/\//i.test(clean(data.url, 1000)) ? clean(data.url, 1000) : "";
  const doi = clean(data.DOI, 200).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  const publication = clean(data.publicationTitle || data.bookTitle || data.publisher, 300);
  const tags = (data.tags || []).map(tag => clean(tag.tag, 80)).filter(Boolean).slice(0, 30);
  return {
    key,
    source: { source_type: "zotero", title, url: url || (doi ? `https://doi.org/${doi}` : null), creator: creator || null, publication: publication || null, doi: doi || null, zotero_item_key: key },
    reference: {
      title, reference_type: typeMap[data.itemType] ?? "other", creator: creator || null, reference_date: zoteroYear(data.date) || null,
      location: clean(data.place, 200) || null, description: clean(data.abstractNote, 4000) || null,
      metadata: { zotero: { key, item_type: data.itemType, version: item.version ?? null, tags, publication: publication || null, doi: doi || null, isbn: clean(data.ISBN, 60) || null, url: url || null } },
    },
  };
}
