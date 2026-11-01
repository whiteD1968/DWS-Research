import { opportunityKinds, type OpportunityKind } from "@/lib/opportunities";

// The scout runs saved web searches about once a day and keeps new results as leads until you track or dismiss them.
export const leadParent = "opportunity_lead";
export const scoutSettingsParent = "opportunity_settings";
export const scoutIntervalHours = 20;
export const maxSearches = 8;
// Built around the studio's practice: installations, design-build, additive manufacturing, furniture and products, craft and public art,
// across the US with extra weight on Florida and the surrounding states.
export const defaultSearches = [
  "public art call for artists Florida 2026",
  "public art RFQ sculpture installation Georgia Alabama South Carolina",
  "design build installation open call architects designers 2026",
  "3D printing additive manufacturing architecture research grant",
  "furniture design competition open call craft makers",
  "artist residency digital fabrication craft application deadline",
  "Florida individual artist fellowship grant deadline",
  "public art commission call for artists fabrication materials",
];
// The first generic searches; settings still holding exactly these move to the studio searches above.
const firstSearches = ["artist open call deadline", "artist residency application deadline", "artist grant application deadline", "juried exhibition call for artists"];
// Results mentioning these are left out: calls meant for students.
export const defaultSkip = ["student competition", "student design competition", "students only", "student artists", "undergraduate students", "graduate students", "high school", "K-12", "youth"];
export const maxSkip = 30;

export type Lead = { id: string; title: string; url: string; source: string; summary: string; query: string; foundAt: string; deadline: string; kind: OpportunityKind };

export function parseSearches(value: unknown) {
  const lines = (typeof value === "string" ? value.split("\n") : Array.isArray(value) ? value : []).map(line => String(line).replace(/\s+/g, " ").trim().slice(0, 120)).filter(Boolean);
  return [...new Set(lines)].slice(0, maxSearches);
}

// The searches to run: the saved ones, unless they are still the first generic set.
export function currentSearches(saved: unknown) {
  const searches = parseSearches(saved);
  const untouched = searches.length === firstSearches.length && firstSearches.every(search => searches.includes(search));
  return searches.length && !untouched ? searches : defaultSearches;
}

export function parseSkip(value: unknown) {
  const lines = (typeof value === "string" ? value.split("\n") : Array.isArray(value) ? value : []).map(line => String(line).replace(/\s+/g, " ").trim().slice(0, 60)).filter(Boolean);
  return [...new Set(lines.map(line => line.toLowerCase()))].slice(0, maxSkip);
}
// Saved skip words, or the defaults when none were ever saved.
export const currentSkip = (saved: unknown) => (Array.isArray(saved) ? parseSkip(saved) : defaultSkip.map(word => word.toLowerCase()));
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// True when a result mentions any skip phrase as whole words.
export function shouldSkip(text: string, skip: string[]) {
  const lower = text.toLowerCase();
  return skip.some(phrase => new RegExp(`(^|[^a-z0-9])${escape(phrase.toLowerCase())}([^a-z0-9]|$)`).test(lower));
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

const recentlyClosedDays = 120;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
// Picks out a deadline written the usual ways ("Deadline: March 3, 2027", "due 3/3/2027", "Apply by Mar 3").
export function guessDeadline(text: string, today: string) {
  const lower = text.toLowerCase();
  const candidates: string[] = [];
  const iso = (y: number, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : "");
  // A date without a year that passed in the last few months is a closed call, not next year's.
  const yearless = (month: number, day: number) => {
    const thisYear = iso(Number(today.slice(0, 4)), month, day);
    return thisYear >= today || daysBetween(thisYear, today) <= recentlyClosedDays ? thisYear : iso(Number(today.slice(0, 4)) + 1, month, day);
  };
  const monthNumber = (name: string) => months.findIndex(month => month.startsWith(name.slice(0, 3))) + 1;
  for (const match of lower.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?/g)) {
    const month = monthNumber(match[1]);
    candidates.push(match[3] ? iso(Number(match[3]), month, Number(match[2])) : yearless(month, Number(match[2])));
  }
  // "18 October 2026", the way many European and UK calls write it.
  for (const match of lower.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(?:,?\s+(20\d{2}))?/g)) {
    const month = monthNumber(match[2]);
    candidates.push(match[3] ? iso(Number(match[3]), month, Number(match[1])) : yearless(month, Number(match[1])));
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

// Directory and roundup pages list other calls rather than being one, so the scout skips them.
const listingPattern = /\b(?:full directory|directory of|list of|all (?:open )?calls|calls? ending soon|ending soon|this (?:week|month)'?s? (?:open )?calls|roundup|round-up|(?:\d+|top|best) (?:open calls|opportunities|residencies|grants|competitions|calls for artists))\b/i;
export const looksLikeListing = (title: string) => listingPattern.test(title);

// Search results often end with the site's name ("… - fundsforNGOs", "… | Arthead"), which the lead already shows as its source.
const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");
export function cleanTitle(title: string, source: string) {
  const site = squash(source);
  let text = title.trim();
  for (let round = 0; round < 2 && site; round += 1) {
    const match = text.match(/^(.{12,}?)\s+[-|–—·:]\s+([^-|–—·]{2,60})$/);
    const tail = match ? squash(match[2]) : "";
    if (!match || !tail || !(tail === site || (tail.length >= 4 && (site.includes(tail) || tail.includes(site))))) break;
    text = match[1].trim();
  }
  return text;
}

const str = (value: unknown) => (typeof value === "string" ? value : "");
export function leadFrom(row: { id?: unknown; title?: unknown; plain_text?: unknown; metadata?: unknown }): Lead | null {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const url = str(meta.url);
  if (!url) return null;
  const kind = kindExists(str(meta.kind)) ? (str(meta.kind) as OpportunityKind) : "other";
  return { id: str(row.id), title: cleanTitle(str(row.title), str(meta.source)) || url, url, source: str(meta.source), summary: str(row.plain_text), query: str(meta.query), foundAt: str(meta.found_at), deadline: str(meta.deadline), kind };
}
