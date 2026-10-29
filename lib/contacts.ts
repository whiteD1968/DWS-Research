// Contacts are notes with parent_type "contact": the name is the title, details and a touchpoint log live in metadata.
export const contactParent = "contact";
export const contactLinkType = "contact_link";

export const contactRoles = [
  { key: "curator", label: "Curator" },
  { key: "gallerist", label: "Gallerist" },
  { key: "juror", label: "Juror" },
  { key: "collaborator", label: "Collaborator" },
  { key: "colleague", label: "Colleague" },
  { key: "mentor", label: "Mentor" },
  { key: "student", label: "Student" },
  { key: "press", label: "Writer / press" },
  { key: "collector", label: "Collector" },
  { key: "funder", label: "Funder" },
  { key: "other", label: "Other" },
] as const;
export type ContactRole = (typeof contactRoles)[number]["key"];
export const roleLabel = (key: ContactRole) => contactRoles.find(role => role.key === key)!.label;
export function parseRole(value: unknown): ContactRole {
  return contactRoles.some(role => role.key === value) ? (value as ContactRole) : "other";
}

export type Touch = { date: string; text: string };
export type Contact = { id: string; name: string; notes: string; role: ContactRole; organization: string; email: string; phone: string; website: string; instagram: string; city: string; howMet: string; followUp: string; log: Touch[] };

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
export function parseDay(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  if (!isoDate.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

export function contactFrom(row: { id?: unknown; title?: unknown; plain_text?: unknown; metadata?: unknown }): Contact | null {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const name = str(row.title);
  if (!name) return null;
  const log = Array.isArray(meta.log) ? meta.log.flatMap(item => item && typeof item === "object" && parseDay((item as Touch).date) && str((item as Touch).text) ? [{ date: (item as Touch).date, text: str((item as Touch).text) }] : []) : [];
  return { id: str(row.id), name, notes: str(row.plain_text), role: parseRole(meta.role), organization: str(meta.organization), email: str(meta.email), phone: str(meta.phone), website: str(meta.website), instagram: str(meta.instagram).replace(/^@/, ""), city: str(meta.city), howMet: str(meta.how_met), followUp: parseDay(meta.follow_up) || "", log: log.sort((a, b) => b.date.localeCompare(a.date)) };
}

export const lastTouch = (contact: Pick<Contact, "log">) => contact.log[0]?.date ?? "";

// "Last in touch" in words; anyone quiet for six months or more is worth a nudge.
export const quietDays = 182;
export function touchLabel(day: string, today: string) {
  if (!day) return "No touchpoints yet";
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86400000);
  if (days <= 0) return "In touch today";
  if (days === 1) return "In touch yesterday";
  if (days < 14) return `In touch ${days} days ago`;
  if (days < 60) return `In touch ${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `In touch ${Math.round(days / 30.44)} months ago`;
  const years = Math.round(days / 365.25);
  return `In touch ${years} ${years === 1 ? "year" : "years"} ago`;
}
export function isQuiet(contact: Pick<Contact, "log">, today: string) {
  const day = lastTouch(contact);
  return !day || Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`) >= quietDays * 86400000;
}

export function matchesContact(contact: Contact, query: string) {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  return [contact.name, contact.organization, contact.city, contact.email, contact.instagram, contact.howMet, contact.notes, roleLabel(contact.role)].some(value => value.toLowerCase().includes(text));
}

export function sortContacts(a: Contact, b: Contact) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function normalizeWebsite(value: string) {
  const text = value.trim();
  if (!text) return "";
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try { const url = new URL(withScheme); return url.hostname.includes(".") ? url.toString() : null; } catch { return null; }
}

const csvCell = (value: string) => (/[",\n\r]/.test(value) || /^[=+\-@]/.test(value) ? `"${(/^[=+\-@]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"` : value);
// Spreadsheet-safe CSV: quotes where needed and neutralizes cells that start like formulas.
export function contactsCsv(contacts: Contact[]) {
  const header = ["Name", "Role", "Organization", "Email", "Phone", "Website", "Instagram", "City", "How we met", "Last in touch", "Follow up", "Notes"];
  const rows = contacts.map(contact => [contact.name, roleLabel(contact.role), contact.organization, contact.email, contact.phone, contact.website, contact.instagram ? `@${contact.instagram}` : "", contact.city, contact.howMet, lastTouch(contact), contact.followUp, contact.notes]);
  return [header, ...rows].map(row => row.map(cell => csvCell(cell)).join(",")).join("\r\n");
}
