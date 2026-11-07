// APA 7th edition reference formatting. Pure and client-safe, so Discover cards,
// the reference page and the save action all produce the same text.

export type CitationName = { family?: string; given?: string; literal?: string };
export type CitationKind = "journal-article" | "book" | "book-chapter" | "report" | "thesis" | "conference-paper" | "webpage" | "image" | "artwork" | "video";
export type CitationData = {
  kind: CitationKind;
  authors?: CitationName[];
  title: string;
  year?: string;
  month?: number;
  day?: number;
  containerTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  place?: string;
  edition?: string;
  description?: string;
  siteName?: string;
  doi?: string;
  url?: string;
  accessed?: string;
};
export type CitationPart = { text: string; italic?: boolean };
export type StoredCitation = { style: "apa7"; text: string; html: string; generated_at: string; edited?: boolean };

const clean = (value: unknown, max = 500) => typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const particles = new Set(["van", "von", "der", "den", "de", "del", "della", "di", "da", "du", "la", "le", "ter", "ten", "dos", "das", "bin", "al"]);

// "Jane Q. Doe" -> { family: "Doe", given: "Jane Q." }; "Doe, Jane" stays family-first.
export function parsePersonName(value: string): CitationName {
  const name = clean(value, 200).replace(/\s*\((?:[^)]*)\)\s*$/, "");
  if (!name) return {};
  if (name.includes(",")) {
    const [family, ...rest] = name.split(",");
    const given = rest.join(" ").trim();
    if (/^(jr|sr|ii|iii|iv)\.?$/i.test(given)) return parsePersonName(`${family}`);
    return given ? { family: family.trim(), given } : { literal: family.trim() };
  }
  const words = name.split(" ");
  if (words.length === 1) return { literal: name };
  let start = words.length - 1;
  while (start > 1 && particles.has(words[start - 1].toLowerCase())) start -= 1;
  return { family: words.slice(start).join(" "), given: words.slice(0, start).join(" ") };
}

// Accepts the site's free-text creator labels: "A and B", "A, B, and C", "A et al.", "A; B".
export function parseCreatorLabel(value: unknown): CitationName[] {
  const label = clean(value, 1000).replace(/\s+et al\.?$/i, "");
  if (!label) return [];
  const parts = label.includes(";") ? label.split(";") : label.split(/,\s*(?:and|&)\s+|\s+(?:and|&)\s+|,\s+(?=[^,]+\s[^,]+)/);
  return parts.map(part => part.trim()).filter(Boolean).map(parsePersonName).filter(name => name.family || name.literal);
}

function initials(given: string) {
  return given.split(/\s+/).filter(Boolean).map(word => word.split("-").map(piece => {
    const letter = piece.replace(/[^\p{L}]/gu, "").charAt(0);
    return letter ? `${letter.toUpperCase()}.` : "";
  }).filter(Boolean).join("-")).filter(Boolean).join(" ");
}

function formatName(name: CitationName) {
  if (name.literal) return name.literal;
  const given = name.given ? initials(name.given) : "";
  return given ? `${name.family}, ${given}` : name.family ?? "";
}

export function formatApaAuthors(names: CitationName[] = []) {
  const formatted = names.map(formatName).filter(Boolean);
  if (!formatted.length) return "";
  if (formatted.length === 1) return formatted[0];
  if (formatted.length <= 20) return `${formatted.slice(0, -1).join(", ")}, & ${formatted[formatted.length - 1]}`;
  return `${formatted.slice(0, 19).join(", ")}, . . . ${formatted[formatted.length - 1]}`;
}

const endWithPeriod = (text: string) => /[.?!]$/.test(text) ? text : `${text}.`;

function dateText(data: CitationData) {
  if (!data.year) return "n.d.";
  const withDay = data.kind === "webpage" || data.kind === "video";
  if (withDay && data.month) return `${data.year}, ${months[data.month - 1]}${data.day ? ` ${data.day}` : ""}`;
  return data.year;
}

export function doiUrl(doi?: string) {
  const value = clean(doi, 300).replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  return value ? `https://doi.org/${value}` : "";
}

export function formatApa(input: CitationData): CitationPart[] {
  const data = { ...input, title: clean(input.title, 1000) || "Untitled" };
  const parts: CitationPart[] = [];
  const add = (text: string, italic = false) => { if (text) parts.push(italic ? { text, italic } : { text }); };
  const authors = formatApaAuthors(data.authors);
  const date = `(${dateText(data)}).`;
  const link = doiUrl(data.doi) || clean(data.url, 2000);
  const italicTitle = ["book", "report", "thesis", "webpage", "image", "artwork", "video"].includes(data.kind);
  const bracket = data.description ? ` [${data.description}]` : "";

  // Title: italic for stand-alone works, plain for parts of a larger work.
  const writeTitle = () => {
    const title = data.title.replace(/[.]$/, "");
    if (italicTitle) {
      add(title, true);
      const suffix = `${data.edition ? ` (${data.edition} ed.)` : ""}${bracket}`;
      add(suffix ? `${suffix}.` : /[?!]$/.test(title) ? "" : ".");
    } else add(endWithPeriod(title + bracket));
  };

  if (authors) { add(`${endWithPeriod(authors)} `); add(`${date} `); writeTitle(); }
  else { writeTitle(); add(` ${date}`); }

  if (data.kind === "journal-article" || data.kind === "conference-paper") {
    if (data.containerTitle) {
      add(" ");
      add(data.volume ? `${data.containerTitle}, ${data.volume}` : data.containerTitle, true);
      add(`${data.issue ? `(${data.issue})` : ""}${data.pages ? `, ${data.pages}` : ""}.`);
    }
  } else if (data.kind === "book-chapter") {
    if (data.containerTitle) { add(" In "); add(data.containerTitle, true); add(`${data.pages ? ` (pp. ${data.pages})` : ""}.`); }
    if (data.publisher) add(` ${endWithPeriod(data.publisher)}`);
  } else if (["book", "report", "thesis"].includes(data.kind)) {
    if (data.publisher && data.publisher !== formatApaAuthors(data.authors)) add(` ${endWithPeriod(data.publisher)}`);
  } else {
    // Web pages, images, artworks and videos name the site or holding institution.
    const site = data.siteName || data.publisher || data.containerTitle;
    const where = [site, data.place].filter(Boolean).join(", ");
    if (where && where !== authors.replace(/\.$/, "")) add(` ${endWithPeriod(where)}`);
  }

  if (link) {
    const retrieved = !data.year && data.kind === "webpage" && data.accessed ? retrievedOn(data.accessed) : "";
    add(retrieved ? ` Retrieved ${retrieved}, from ${link}` : ` ${link}`);
  }
  return parts;
}

function retrievedOn(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const citationText = (parts: CitationPart[]) => parts.map(part => part.text).join("");
export const citationHtml = (parts: CitationPart[]) => parts.map(part => part.italic ? `<i>${escape(part.text)}</i>` : escape(part.text)).join("");

export function storedCitation(data: CitationData, now = new Date()): StoredCitation {
  const parts = formatApa(data);
  return { style: "apa7", text: citationText(parts), html: citationHtml(parts), generated_at: now.toISOString() };
}

// Pull year/month/day out of "2021", "2021-05-03", "2021-05-03T10:00:00Z" or "May 3, 2021".
export function parseCitationDate(value: unknown): Pick<CitationData, "year" | "month" | "day"> {
  const text = clean(value, 100);
  const iso = text.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?/);
  if (iso) return { year: iso[1], month: iso[2] ? Number(iso[2]) || undefined : undefined, day: iso[3] ? Number(iso[3]) || undefined : undefined };
  const year = text.match(/\b(1[0-9]\d\d|20\d\d|21\d\d)\b/);
  return year ? { year: year[1] } : {};
}

const kindByReferenceType: Record<string, CitationKind> = {
  paper: "journal-article", article: "journal-article", journal: "journal-article", academic: "journal-article",
  book: "book", book_chapter: "book-chapter", report: "report", standard: "report", thesis: "thesis",
  image: "image", drawing: "image", video: "video", website: "webpage",
};
const kindByZotero: Record<string, CitationKind> = {
  journalArticle: "journal-article", magazineArticle: "journal-article", newspaperArticle: "journal-article",
  book: "book", bookSection: "book-chapter", report: "report", thesis: "thesis", conferencePaper: "conference-paper",
  webpage: "webpage", blogPost: "webpage", artwork: "artwork", videoRecording: "video", film: "video", map: "image",
};

type ReferenceLike = { title: string; reference_type?: string | null; creator?: string | null; reference_date?: string | null; location?: string | null; metadata?: Record<string, unknown> | null; created_at?: string };
type SourceLike = { url?: string | null; publication?: string | null; doi?: string | null; title?: string | null } | null | undefined;

const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

export function isCitationData(value: unknown): value is CitationData {
  const data = record(value);
  return !!data && typeof data.kind === "string" && typeof data.title === "string";
}

// Build citation data for any saved reference: structured provider data first,
// then Zotero fields, then the reference's own title/creator/date/source.
export function citationFromReference(reference: ReferenceLike, source?: SourceLike): CitationData {
  const metadata = reference.metadata ?? {};
  const external = record(metadata.external_result);
  const provided = record(external?.metadata)?.citation ?? metadata.citation;
  const accessed = typeof metadata.accessed_at === "string" ? metadata.accessed_at : reference.created_at;
  if (isCitationData(provided)) {
    // Fields the owner changed after saving win over the provider's record.
    const creatorEdited = reference.creator !== undefined && (reference.creator ?? undefined) !== (external?.creator ?? undefined);
    const dateEdited = reference.reference_date !== undefined && (reference.reference_date ?? undefined) !== (external?.publishedAt ?? undefined);
    return { ...provided, title: reference.title || provided.title, accessed: provided.accessed ?? accessed,
      ...(creatorEdited ? { authors: parseCreatorLabel(reference.creator) } : {}),
      ...(dateEdited ? { year: undefined, month: undefined, day: undefined, ...parseCitationDate(reference.reference_date) } : {}) };
  }

  const zotero = record(metadata.zotero);
  const date = parseCitationDate(zotero?.date ?? reference.reference_date);
  const zoteroCreators = Array.isArray(zotero?.creators) ? (zotero.creators as CitationName[]).filter(name => name && (name.family || name.literal)) : [];
  const type = reference.reference_type ?? "";
  // Images cite the page that published them rather than the bare file.
  const url = clean(external?.sourcePageUrl || source?.url || zotero?.url || metadata.normalized_url, 2000);
  const kind = (zotero && kindByZotero[String(zotero.item_type)]) || kindByReferenceType[type] ||
    (external?.resultType === "image" ? "image" : external?.resultType === "video" ? "video" : "webpage");
  const publication = clean(zotero?.publication ?? source?.publication, 300);
  let host = "";
  try { host = url ? new URL(url).hostname.replace(/^www\./, "") : ""; } catch { /* not a URL */ }
  const siteName = clean(external?.sourceName, 200) || host;
  return {
    kind,
    authors: zoteroCreators.length ? zoteroCreators : parseCreatorLabel(reference.creator),
    title: reference.title, ...date,
    containerTitle: kind === "journal-article" || kind === "conference-paper" || kind === "book-chapter" ? publication || undefined : undefined,
    volume: clean(zotero?.volume, 40) || undefined, issue: clean(zotero?.issue, 40) || undefined, pages: clean(zotero?.pages, 40) || undefined,
    publisher: clean(zotero?.publisher, 300) || (kind === "book" || kind === "report" ? publication || undefined : undefined),
    siteName: ["webpage", "image", "video", "artwork"].includes(kind) ? siteName || undefined : undefined,
    description: kind === "image" ? "Image" : kind === "video" ? "Video" : undefined,
    doi: clean(source?.doi ?? zotero?.doi, 300) || undefined,
    url: url || undefined, accessed,
  };
}

type ResultLike = { title: string; resultType?: string; creator?: string; publishedAt?: string; url: string; sourcePageUrl?: string; sourceName?: string; metadata?: Record<string, unknown> };
// The citation a Discover result will receive when saved.
export function citationFromResult(result: ResultLike) {
  return citationFromReference({ title: result.title, reference_type: result.resultType, creator: result.creator, reference_date: result.publishedAt,
    metadata: { external_result: result, normalized_url: result.url } }, { url: result.url });
}

// An edited citation is the owner's text and is kept; anything else is regenerated from current fields.
export function referenceCitation(reference: ReferenceLike, source?: SourceLike): { parts: CitationPart[]; edited: boolean } {
  const stored = record(reference.metadata?.apa_citation);
  if (stored?.edited && typeof stored.text === "string" && stored.text.trim()) return { parts: [{ text: stored.text.trim() }], edited: true };
  return { parts: formatApa(citationFromReference(reference, source)), edited: false };
}
