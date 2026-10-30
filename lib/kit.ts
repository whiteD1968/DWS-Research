// The application kit: reusable bios, statements, letters, budgets, and captioned image sets that fill an application.

export const kitParent = "kit";
export const kitKinds = [
  { key: "bio_short", label: "Short bio", hint: "Third person, 50 to 100 words.", words: ["short bio", "bio (short)", "brief bio"] },
  { key: "bio_long", label: "Long bio", hint: "Third person, 150 to 300 words.", words: ["bio", "biography"] },
  { key: "artist_statement", label: "Artist statement", hint: "First person, about the work.", words: ["artist statement", "statement"] },
  { key: "research_statement", label: "Research statement", hint: "For academic and grant applications.", words: ["research statement", "research"] },
  { key: "teaching_statement", label: "Teaching statement", hint: "Philosophy and methods.", words: ["teaching statement", "teaching philosophy", "teaching"] },
  { key: "diversity_statement", label: "Diversity statement", hint: "Often requested for faculty jobs.", words: ["diversity", "dei"] },
  { key: "proposal", label: "Project proposal", hint: "What you'll make, where, and when.", words: ["proposal", "project description", "narrative"] },
  { key: "cover_letter", label: "Cover letter", hint: "A base letter to adapt.", words: ["cover letter", "letter of interest", "letter"] },
  { key: "budget", label: "Budget", hint: "Line items and totals, as text.", words: ["budget"] },
  { key: "image_set", label: "Image set", hint: "Images with captions, exported as an image list.", words: ["images", "image list", "work samples", "portfolio", "slides"] },
  { key: "other", label: "Other", hint: "Anything else you reuse.", words: [] },
] as const;
export type KitKind = (typeof kitKinds)[number]["key"];
export const kitKind = (key: KitKind) => kitKinds.find(kind => kind.key === key)!;
export function parseKitKind(value: unknown): KitKind | null {
  return kitKinds.some(kind => kind.key === value) ? (value as KitKind) : null;
}

export type KitImage = { mediaId: string; title: string; year: string; medium: string; dimensions: string; credit: string };
export type KitItem = { id: string; kind: KitKind; title: string; text: string; images: KitImage[]; updatedAt: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && uuid.test(value);
const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export function parseKitImages(value: unknown): KitImage[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap(item => {
    const raw = (item || {}) as Record<string, unknown>;
    const mediaId = raw.mediaId ?? raw.media_id;
    if (!isUuid(mediaId) || seen.has(mediaId)) return [];
    seen.add(mediaId);
    return [{ mediaId, title: str(raw.title, 200), year: str(raw.year, 20), medium: str(raw.medium, 200), dimensions: str(raw.dimensions, 120), credit: str(raw.credit, 200) }];
  }).slice(0, 40);
}

export function kitFrom(row: { id?: unknown; title?: unknown; plain_text?: unknown; metadata?: unknown; updated_at?: unknown }): KitItem | null {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const kind = parseKitKind(meta.kind);
  if (!kind || !isUuid(row.id)) return null;
  return { id: row.id, kind, title: str(row.title, 300) || kitKind(kind).label, text: typeof row.plain_text === "string" ? row.plain_text : "", images: kind === "image_set" ? parseKitImages(meta.images) : [], updatedAt: typeof row.updated_at === "string" ? row.updated_at : "" };
}

export const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
export const charCount = (text: string) => [...text.trim()].length;

// "Untitled, 2024. Stoneware and glaze. 12 × 8 × 8 in. Courtesy the artist."
export function imageCaption(image: KitImage) {
  const head = [image.title ? image.title : "Untitled", image.year].filter(Boolean).join(", ");
  return [head, image.medium, image.dimensions, image.credit].filter(Boolean).map(part => (/[.!?]$/.test(part) ? part : `${part}.`)).join(" ");
}

// Picks the kit item most likely meant by a checklist line like "Artist statement (500 words)".
export function suggestKit(label: string, items: KitItem[]) {
  const text = label.toLowerCase();
  let best: { item: KitItem; score: number } | null = null;
  for (const item of items) {
    const kind = kitKind(item.kind);
    const score = Math.max(0, ...kind.words.map(word => (text.includes(word) ? word.length : 0)), item.title && text.includes(item.title.toLowerCase()) ? item.title.length + 5 : 0);
    if (score && (!best || score > best.score || (score === best.score && item.updatedAt > best.item.updatedAt))) best = { item, score };
  }
  return best?.item ?? null;
}

export function groupKit(items: KitItem[]) {
  return kitKinds.map(kind => ({ kind, items: items.filter(item => item.kind === kind.key).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) })).filter(group => group.items.length);
}
