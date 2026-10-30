import type { DossierSection } from "@/lib/dossier";

// CV entries are notes with parent_type "cv"; their fields live in metadata so no migration is needed.
export const cvParent = "cv";

type PeopleMode = "prefix" | "curated" | "with";
export const cvCategories = [
  { key: "solo_exhibition", label: "Solo exhibitions", one: "Solo exhibition", section: "research", venue: "Gallery or venue", people: "Curator", mode: "curated", quoted: false },
  { key: "group_exhibition", label: "Group exhibitions", one: "Group exhibition", section: "research", venue: "Gallery or venue", people: "Curator", mode: "curated", quoted: false },
  { key: "publication", label: "Publications", one: "Publication", section: "research", venue: "Journal, book, or publisher", people: "Authors or editors", mode: "prefix", quoted: true },
  { key: "press", label: "Bibliography", one: "Press or review", section: "research", venue: "Publication", people: "Writer", mode: "prefix", quoted: true },
  { key: "award", label: "Awards & grants", one: "Award or grant", section: "research", venue: "Awarded by", people: "Shared with", mode: "with", quoted: false },
  { key: "residency", label: "Residencies", one: "Residency", section: "research", venue: "Organization", people: "With", mode: "with", quoted: false },
  { key: "collection", label: "Public collections", one: "Collection", section: "research", venue: "Institution", people: "", mode: "with", quoted: false },
  { key: "presentation", label: "Lectures & presentations", one: "Lecture or presentation", section: "research", venue: "Host or conference", people: "Co-presenters", mode: "with", quoted: true },
  { key: "teaching", label: "Teaching", one: "Course or workshop", section: "teaching", venue: "Institution", people: "Co-taught with", mode: "with", quoted: false },
  { key: "service", label: "Service", one: "Service", section: "service", venue: "Organization", people: "With", mode: "with", quoted: false },
] as const satisfies readonly { key: string; label: string; one: string; section: DossierSection; venue: string; people: string; mode: PeopleMode; quoted: boolean }[];
export type CvCategory = (typeof cvCategories)[number]["key"];
export const cvCategory = (key: CvCategory) => cvCategories.find(category => category.key === key)!;
export function parseCvCategory(value: unknown): CvCategory | null {
  return cvCategories.some(category => category.key === value) ? (value as CvCategory) : null;
}

// Dates are a year, optionally with a month, so entries sort correctly without pretending to know the day.
export function parseCvDate(year: unknown, month?: unknown) {
  const y = Number(year); const m = month === undefined || month === "" || month === null ? 0 : Number(month);
  if (!Number.isInteger(y) || y < 1950 || y > 2100 || !Number.isInteger(m) || m < 0 || m > 12) return null;
  return m ? `${y}-${String(m).padStart(2, "0")}` : String(y);
}

export type CvFields = { category: CvCategory; title: string; venue: string; location: string; date: string; end_date: string; people: string; url: string };
const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
export function cvFields(row: { title?: unknown; metadata?: unknown }): CvFields | null {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const category = parseCvCategory(meta.category);
  if (!category) return null;
  return { category, title: str(row.title), venue: str(meta.venue), location: str(meta.location), date: str(meta.date), end_date: str(meta.end_date), people: str(meta.people), url: str(meta.url) };
}

export function cvYears(entry: Pick<CvFields, "date" | "end_date">) {
  const start = entry.date.slice(0, 4); const end = entry.end_date.slice(0, 4);
  return end && end !== start ? `${start}–${end}` : start;
}

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);
// The citation text that follows the year, in the usual artist-CV form for each category.
export function cvCitation(entry: CvFields) {
  const kind = cvCategory(entry.category);
  const place = [entry.venue, entry.location].filter(Boolean).join(", ");
  if (kind.quoted) {
    const head = entry.title ? `“${entry.title.replace(/[.,]$/, "")}${place ? ",”" : ".”"}` : "";
    const body = [head, place && sentence(place)].filter(Boolean).join(" ");
    const lead = kind.mode === "prefix" && entry.people ? `${sentence(entry.people)} ` : "";
    const tail = kind.mode === "with" && entry.people ? ` With ${sentence(entry.people)}` : "";
    return `${lead}${body}${tail}`.trim();
  }
  const main = [entry.title, place].filter(Boolean).join(", ");
  if (!entry.people) return main;
  return kind.mode === "curated" ? `${main}, curated by ${entry.people}` : `${main} (with ${entry.people})`;
}

// Entries sort newest first inside each category, and categories keep the standard CV order.
export function groupCv<T extends CvFields>(entries: T[]) {
  return cvCategories.map(category => ({ category, entries: entries.filter(entry => entry.category === category.key).sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title)) })).filter(group => group.entries.length);
}
