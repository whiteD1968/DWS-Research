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

// Weeks of days ending on today, Monday-first, for the journal rhythm grid.
export function rhythmWeeks(today: string, weeks: number) {
  const end = new Date(`${today}T00:00:00Z`);
  const offset = (end.getUTCDay() + 6) % 7;
  const start = new Date(end); start.setUTCDate(end.getUTCDate() - offset - (weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, week) => Array.from({ length: 7 }, (_, day) => {
    const date = new Date(start); date.setUTCDate(start.getUTCDate() + week * 7 + day);
    const iso = date.toISOString().slice(0, 10);
    return iso > today ? null : iso;
  }));
}

// The studio's calendar day (FAU is on Eastern time), so pages rendered on the server don't jump to tomorrow at 8pm.
export const studioTimeZone = "America/New_York";
export function studioToday(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: studioTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
