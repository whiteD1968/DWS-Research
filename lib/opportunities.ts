import type { CvCategory } from "@/lib/cv";

// Opportunities are notes with parent_type "opportunity"; deadlines also set the note's reminder so they surface on Home.
export const opportunityParent = "opportunity";

export const opportunityKinds = [
  { key: "exhibition", label: "Exhibition call", cv: "group_exhibition", materials: ["Work images", "Image list", "Artist statement", "CV", "Entry fee"] },
  { key: "grant", label: "Grant", cv: "award", materials: ["Project proposal", "Budget", "CV", "Work samples", "Letters of support"] },
  { key: "fellowship", label: "Fellowship", cv: "award", materials: ["Statement", "Work samples", "CV", "References"] },
  { key: "residency", label: "Residency", cv: "residency", materials: ["Statement of intent", "Work images", "CV", "References", "Application fee"] },
  { key: "commission", label: "Commission / public art", cv: "solo_exhibition", materials: ["Concept proposal", "Budget", "Past project images", "CV", "Timeline"] },
  { key: "publication", label: "Publication call", cv: "publication", materials: ["Abstract", "Manuscript", "Images", "Bio"] },
  { key: "conference", label: "Conference / talk", cv: "presentation", materials: ["Abstract", "Bio", "Headshot"] },
  { key: "job", label: "Job", cv: "teaching", materials: ["Cover letter", "CV", "Teaching statement", "Portfolio", "References"] },
  { key: "other", label: "Other", cv: "group_exhibition", materials: ["Application"] },
] as const satisfies readonly { key: string; label: string; cv: CvCategory; materials: readonly string[] }[];
export type OpportunityKind = (typeof opportunityKinds)[number]["key"];
export const opportunityKind = (key: OpportunityKind) => opportunityKinds.find(kind => kind.key === key)!;
export function parseOpportunityKind(value: unknown): OpportunityKind | null {
  return opportunityKinds.some(kind => kind.key === value) ? (value as OpportunityKind) : null;
}

export const opportunityStages = [
  { key: "interested", label: "Interested" },
  { key: "preparing", label: "Preparing" },
  { key: "submitted", label: "Submitted" },
  { key: "decided", label: "Decided" },
] as const;
export const opportunityStatuses = ["interested", "preparing", "submitted", "accepted", "declined", "withdrawn"] as const;
export type OpportunityStatus = (typeof opportunityStatuses)[number];
export const statusLabels: Record<OpportunityStatus, string> = { interested: "Interested", preparing: "Preparing", submitted: "Submitted", accepted: "Accepted", declined: "Not selected", withdrawn: "Withdrawn" };
export function parseStatus(value: unknown): OpportunityStatus | null {
  return opportunityStatuses.includes(value as OpportunityStatus) ? (value as OpportunityStatus) : null;
}
export const stageOf = (status: OpportunityStatus) => (status === "accepted" || status === "declined" || status === "withdrawn" ? "decided" : status);

export type Material = { label: string; done: boolean };
export type Opportunity = { id: string; title: string; notes: string; kind: OpportunityKind; organization: string; location: string; deadline: string; url: string; fee: string; award: string; status: OpportunityStatus; materials: Material[]; cvEntryId: string; decidedAt: string };

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
export function opportunityFrom(row: { id?: unknown; title?: unknown; plain_text?: unknown; metadata?: unknown }): Opportunity | null {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const kind = parseOpportunityKind(meta.kind);
  if (!kind) return null;
  const materials = Array.isArray(meta.materials) ? meta.materials.flatMap(item => item && typeof item === "object" && typeof (item as Material).label === "string" ? [{ label: (item as Material).label, done: Boolean((item as Material).done) }] : []) : [];
  return { id: str(row.id), title: str(row.title), notes: str(row.plain_text), kind, organization: str(meta.organization), location: str(meta.location), deadline: str(meta.deadline), url: str(meta.url), fee: str(meta.fee), award: str(meta.award), status: parseStatus(meta.status) ?? "interested", materials, cvEntryId: str(meta.cv_entry_id), decidedAt: str(meta.decided_at) };
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
export function parseDeadline(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  if (!isoDate.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

export function deadlineDays(deadline: string, today: string) {
  return Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}
export function deadlineLabel(deadline: string, today: string) {
  if (!deadline) return "No deadline";
  const days = deadlineDays(deadline, today);
  if (days < 0) return `Closed ${new Date(`${deadline}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 14) return `${days} days left`;
  return `Due ${new Date(`${deadline}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(days > 300 ? { year: "numeric" } : {}), timeZone: "UTC" })}`;
}
export function deadlineTone(deadline: string, today: string, status: OpportunityStatus) {
  if (!deadline || stageOf(status) === "submitted" || stageOf(status) === "decided") return "calm";
  const days = deadlineDays(deadline, today);
  return days < 0 ? "closed" : days <= 7 ? "soon" : "calm";
}

// The reminder lands a week ahead (or the day before, when the deadline is close), at 9am Eastern.
export function reminderFor(deadline: string, today: string) {
  if (!deadline) return null;
  const days = deadlineDays(deadline, today);
  if (days < 1) return null;
  const lead = days > 7 ? 7 : 1;
  const day = new Date(Date.parse(`${deadline}T00:00:00Z`) - lead * 86400000).toISOString().slice(0, 10);
  const offset = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" }).formatToParts(new Date(`${day}T12:00:00Z`)).find(part => part.type === "timeZoneName")?.value.replace("GMT", "") || -5);
  return new Date(Date.parse(`${day}T09:00:00Z`) - offset * 3600000).toISOString();
}

export function defaultMaterials(kind: OpportunityKind): Material[] {
  return opportunityKind(kind).materials.map(label => ({ label, done: false }));
}

const money = (value: string) => { const number = Number(value.replace(/[^0-9.]/g, "")); return Number.isFinite(number) ? number : 0; };
// Season numbers for the header: what went out this year, what came back, and what it cost.
export function seasonStats(items: Opportunity[], year: string) {
  const sent = items.filter(item => item.status !== "interested" && item.status !== "preparing" && item.status !== "withdrawn" && (item.deadline.startsWith(year) || item.decidedAt.startsWith(year)));
  const decided = sent.filter(item => item.status === "accepted" || item.status === "declined");
  const accepted = decided.filter(item => item.status === "accepted").length;
  return { submitted: sent.length, accepted, rate: decided.length ? Math.round((accepted / decided.length) * 100) : null, fees: sent.reduce((sum, item) => sum + money(item.fee), 0) };
}

export function sortByDeadline(a: Opportunity, b: Opportunity) {
  return (a.deadline || "9999").localeCompare(b.deadline || "9999") || a.title.localeCompare(b.title);
}
