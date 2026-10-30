import { opportunityKinds, type OpportunityKind } from "@/lib/opportunities";

// The scout runs saved web searches about once a day and keeps new results as leads until you track or dismiss them.
export const leadParent = "opportunity_lead";
export const scoutSettingsParent = "opportunity_settings";
export const scoutIntervalHours = 20;
export const maxSearches = 6;
export const defaultSearches = ["artist open call deadline", "artist residency application deadline", "artist grant application deadline", "juried exhibition call for artists"];

export type Lead = { id: string; title: string; url: string; source: string; summary: string; query: string; foundAt: string; deadline: string; kind: OpportunityKind };

export function parseSearches(value: unknown) {
  const lines = (typeof value === "string" ? value.split("\n") : Array.isArray(value) ? value : []).map(line => String(line).replace(/\s+/g, " ").trim().slice(0, 120)).filter(Boolean);
  return [...new Set(lines)].slice(0, maxSearches);
}

export function scoutDue(lastRun: unknown, now = new Date()) {
  const last = typeof lastRun === "string" ? Date.parse(lastRun) : NaN;
  return Number.isNaN(last) || now.getTime() - last >= scoutIntervalHours * 3600000;
}

// URLs are compared without tracking parameters, fragments, or a trailing slash, so the same page isn't suggested twice.
export function leadKey(url: string) {
  try {
    const parsed = new URL(url);
    [...parsed.searchParams.keys()].filter(key => /^(utm_|fbclid|gclid|mc_)/i.test(key)).forEach(key => parsed.searchParams.delete(key));
    parsed.hash = "";
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}${parsed.search}`.toLowerCase();
  } catch { return ""; }
}

const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
// Picks out a deadline written the usual ways ("Deadline: March 3, 2027", "due 3/3/2027", "Apply by Mar 3").
export function guessDeadline(text: string, today: string) {
  const lower = text.toLowerCase();
  const candidates: string[] = [];
  const iso = (y: number, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : "");
  for (const match of lower.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?/g)) {
    const month = months.findIndex(name => name.startsWith(match[1].slice(0, 3))) + 1;
    const year = match[3] ? Number(match[3]) : Number(today.slice(0, 4)) + (iso(Number(today.slice(0, 4)), month, Number(match[2])) < today ? 1 : 0);
    candidates.push(iso(year, month, Number(match[2])));
  }
  for (const match of lower.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g)) candidates.push(iso(Number(match[3]), Number(match[1]), Number(match[2])));
  const near = /deadline|due|apply by|closes|submissions? (?:close|end)/.test(lower);
  const valid = candidates.filter(day => day && !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day);
  const future = valid.filter(day => day >= today).sort();
  return { deadline: near ? (future[0] ?? "") : "", past: valid.length > 0 && !future.length };
}

const kindWords: [OpportunityKind, RegExp][] = [
  ["residency", /residenc/],
  ["fellowship", /fellowship/],
  ["grant", /\bgrants?\b|funding|award of \$/],
  ["commission", /commission|public art|percent for art|rfq|rfp/],
  ["publication", /submissions?|journal|magazine|anthology|publication/],
  ["conference", /conference|symposium|panel proposal|call for papers/],
  ["job", /\bjob\b|faculty|position|professor|lecturer|hiring/],
  ["exhibition", /exhibition|juried|open call|call for (?:artists|entries)|show/],
];
export function guessKind(text: string): OpportunityKind {
  const lower = text.toLowerCase();
  return kindWords.find(([, pattern]) => pattern.test(lower))?.[0] ?? "other";
}
export const kindExists = (kind: string) => opportunityKinds.some(option => option.key === kind);

const str = (value: unknown) => (typeof value === "string" ? value : "");
export function leadFrom(row: { id?: unknown; title?: unknown; plain_text?: unknown; metadata?: unknown }): Lead | null {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const url = str(meta.url);
  if (!url) return null;
  const kind = kindExists(str(meta.kind)) ? (str(meta.kind) as OpportunityKind) : "other";
  return { id: str(row.id), title: str(row.title) || url, url, source: str(meta.source), summary: str(row.plain_text), query: str(meta.query), foundAt: str(meta.found_at), deadline: str(meta.deadline), kind };
}
