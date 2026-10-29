// The tenure dossier is built from what's already in the workspace: each section is a statement note,
// and its evidence is links from that note to projects, topics, references, images, documents, and journal entries.
export const dossierParent = "dossier";
export const dossierSettingsParent = "dossier_settings";
export const evidenceType = "dossier_evidence";

export const dossierSections = [
  { key: "teaching", label: "Teaching", short: "Teaching", prompt: "How you teach, what students make and learn, courses developed, critiques, mentoring." },
  { key: "research", label: "Research & creative work", short: "Research", prompt: "Exhibitions, commissions, publications, residencies, grants, and the inquiry that ties them together." },
  { key: "service", label: "Service", short: "Service", prompt: "Committees, community work, visiting artists, workshops, reviews, and service to the field." },
] as const;
export type DossierSection = (typeof dossierSections)[number]["key"];
export const sectionLabel = (key: DossierSection) => dossierSections.find(section => section.key === key)!.label;

export function parseSection(value: unknown): DossierSection | null {
  return dossierSections.some(section => section.key === value) ? (value as DossierSection) : null;
}

// Evidence can be any record you can open in the workspace.
export const evidenceKinds = ["project", "research_thread", "reference", "media", "note", "board", "collection"] as const;
export type EvidenceKind = (typeof evidenceKinds)[number];
export const evidenceLabels: Record<EvidenceKind, string> = { project: "Project", research_thread: "Research topic", reference: "Reference", media: "Image or document", note: "Note", board: "Board", collection: "Collection" };
export function parseEvidence(value: unknown) {
  const [kind, id] = typeof value === "string" ? value.split(":") : [];
  return evidenceKinds.includes(kind as EvidenceKind) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || "") ? { kind: kind as EvidenceKind, id } : null;
}

// Journal entries can be filed straight into a section from the composer's link menu.
export const dossierLinkPrefix = "dossier:";
export const dossierLinkGroup = { label: "Tenure dossier", options: dossierSections.map(section => ({ value: `${dossierLinkPrefix}${section.key}`, label: section.label })) };
export function parseDossierLink(value: unknown) {
  return typeof value === "string" && value.startsWith(dossierLinkPrefix) ? parseSection(value.slice(dossierLinkPrefix.length)) : null;
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
export function parseReviewDate(value: unknown) {
  if (typeof value !== "string" || !isoDate.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}
export function daysUntil(day: string, today: string) {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}
export function countdownLabel(days: number) {
  if (days < 0) return `${-days} ${days === -1 ? "day" : "days"} ago`;
  if (days === 0) return "Today";
  if (days < 60) return `${days} ${days === 1 ? "day" : "days"} to go`;
  const months = Math.round(days / 30.44);
  return months < 24 ? `About ${months} months to go` : `About ${Math.round(days / 365.25)} years to go`;
}
export const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
