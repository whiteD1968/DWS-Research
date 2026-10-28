// Journal entries are notes with parent_type "journal"; their day lives in metadata so it can differ from when they were typed.
export const journalParent = "journal";
export const journalPageSize = 20;
export const maxJournalImages = 6;

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
export function parseEntryDate(value: unknown, today: string) {
  if (typeof value !== "string" || !isoDate.test(value)) return today;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? today : value;
}

export const journalLinkKinds = ["project", "research_thread"] as const;
export type JournalLinkKind = (typeof journalLinkKinds)[number];
export function parseJournalLink(value: unknown) {
  const [kind, id] = typeof value === "string" ? value.split(":") : [];
  return journalLinkKinds.includes(kind as JournalLinkKind) && /^[0-9a-f-]{36}$/i.test(id || "") ? { kind: kind as JournalLinkKind, id } : null;
}

export function entryDay(row: { metadata?: unknown; created_at?: unknown }) {
  const day = (row.metadata as { entry_date?: unknown } | null)?.entry_date;
  return typeof day === "string" && isoDate.test(day) ? day : String(row.created_at || "").slice(0, 10);
}

export function formatDay(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? day : date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// Consecutive entries on the same day share one heading.
export function groupByDay<T>(entries: T[], dayOf: (entry: T) => string) {
  const groups: { day: string; entries: T[] }[] = [];
  for (const entry of entries) {
    const day = dayOf(entry);
    if (groups.at(-1)?.day !== day) groups.push({ day, entries: [] });
    groups.at(-1)!.entries.push(entry);
  }
  return groups;
}
