// Describing images with Claude: the request schema, the prompt, and cleanup of what comes back. Pure, so it stays testable.

export const imageTagModel = "claude-opus-5-5";
export const maxImageTags = 6;
export type ImageDescription = { caption: string; altText: string; tags: string[] };
export type AiTagRecord = { tags?: string[]; caption?: string; alt_text?: string; model?: string; at?: string; failed?: boolean; v?: number };

// Structured output: the reply is always this JSON object.
export const imageTagSchema = {
  type: "object",
  properties: {
    caption: { type: "string", description: "One plain sentence saying what the image shows." },
    alt_text: { type: "string", description: "Short alt text for screen readers, under 125 characters." },
    tags: { type: "array", items: { type: "string" }, description: "Three to six short lowercase tags." },
  },
  required: ["caption", "alt_text", "tags"],
  additionalProperties: false,
} as const;

export const imageTagSystem = `You describe images in an artist and researcher's private library so they can find them again by search and tag.

Write a caption: one plain sentence about what the image shows (subject, material, form, setting). Say what is visible; don't guess names, places, or dates you can't see.
Write alt text: a shorter version for screen readers, under 125 characters, without "image of".
Give three to five tags of one to three lowercase words each. A tag is useful only if it separates this image from most others in the library, so:
- Prefer the most specific accurate term: "tensile membrane" over "structure", "robotic arm" over "fabrication", "glaze test" over "ceramics" when that is what it is.
- Cover what a maker would search for: the subject or object type, the material, the process or technique, and the kind of image (sketch, render, diagram, presentation slide, installation view, workshop photo).
- Skip style words that describe most of this library (smooth, organic, curvy, minimal, modern, computational) unless they are the main point of this image.
- Reuse a tag from the existing list whenever one fits instead of inventing a near-synonym, but avoid tags the list marks as already very common unless the image is mainly about that.`;

export type TagUse = { name: string; count: number };

// Tags already on a large share of the library are flagged so Claude reaches for something more specific.
export function broadTags(uses: TagUse[], total: number) {
  return total >= 10 ? uses.filter(use => use.count / total > 0.3).map(use => use.name) : [];
}

export function imageTagPrompt(uses: TagUse[], title: string, total = 0) {
  const sorted = [...uses].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 150);
  const broad = broadTags(sorted, total);
  return [
    title ? `File title: ${title}` : "",
    sorted.length ? `Existing tags in this library, with how many of its ${total} images use each: ${sorted.map(use => `${use.name} (${use.count})`).join(", ")}` : "Existing tags in this library: none yet",
    broad.length ? `Already very common, so use only if the image is mainly about it: ${broad.join(", ")}` : "",
    "Describe this image.",
  ].filter(Boolean).join("\n");
}

// Bumped when the tagging rules change, so images described under older rules are offered again.
export const imageTagVersion = 2;

// Words that fit nearly any image and never help find one.
const filler = new Set(["design", "art", "artwork", "image", "photo", "picture", "object", "abstract", "modern", "aesthetic", "form", "shape", "curvilinear form", "minimalist", "minimal", "organic form"]);

// The previous description's tags that this one dropped; they are unlinked from the image.
export const staleAiTags = (previous: unknown, fresh: string[]) => (Array.isArray(previous) ? previous.map(String) : []).filter(tag => !fresh.some(name => name.toLowerCase() === tag.toLowerCase()));

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

// Lowercase, no stray punctuation, at most three words, matching an existing tag's spelling when it is the same word.
export function normalizeTag(value: unknown, existing: string[] = []) {
  const text = clean(value, 60).toLowerCase().replace(/^#/, "").replace(/[^\p{L}\p{N}\s&'-]/gu, "").replace(/\s+/g, " ").trim();
  if (!text || text.split(" ").length > 3 || text.length > 40) return "";
  return existing.find(tag => tag.toLowerCase() === text) ?? text;
}

export function parseImageDescription(raw: unknown, existing: string[] = []): ImageDescription | null {
  let data = raw;
  if (typeof raw === "string") { try { data = JSON.parse(raw); } catch { return null; } }
  const value = (data || {}) as Record<string, unknown>;
  const caption = clean(value.caption, 300);
  const altText = clean(value.alt_text, 160).replace(/^(an? )?(image|photo|picture) of /i, "");
  const tags = [...new Set((Array.isArray(value.tags) ? value.tags : []).map(tag => normalizeTag(tag, existing)).filter(tag => tag && !filler.has(tag.toLowerCase())))].slice(0, maxImageTags);
  if (!caption && !tags.length) return null;
  return { caption, altText: altText ? altText[0].toUpperCase() + altText.slice(1) : "", tags };
}

export const aiTagRecord = (meta: unknown): AiTagRecord | null => {
  const record = (meta as { ai_tags?: unknown } | null)?.ai_tags;
  return record && typeof record === "object" ? (record as AiTagRecord) : null;
};

// A caption or alt text is replaced only when it is empty or was written by an earlier description, never when it was typed by hand.
export function nextText(current: unknown, previousAi: unknown, fresh: string) {
  const now = typeof current === "string" ? current.trim() : "";
  if (!fresh) return null;
  return !now || (typeof previousAi === "string" && now === previousAi.trim()) ? fresh : null;
}

// The key should be one token. A pasted example command or stray quotes fail inside the HTTP client with the whole value in the message.
export function apiKeyProblem(value: unknown) {
  const key = typeof value === "string" ? value.trim() : "";
  if (!key) return "Image tagging isn't set up yet. Add ANTHROPIC_API_KEY in Vercel.";
  return /^sk-ant-[A-Za-z0-9_-]+$/.test(key) ? "" : "The ANTHROPIC_API_KEY value in Vercel isn't just a key. Replace it with the key alone: one line starting with sk-ant-, with no quotes, spaces, or command around it. Then redeploy.";
}

// Errors are shown in the Library and saved with the image, so anything shaped like a key is blanked out first.
export const redactSecrets = (text: string) => text.replace(/sk-ant-[A-Za-z0-9_-]+/g, "[key hidden]").replace(/(x-api-key|authorization|bearer)\S*\s*[:=]?\s*\S+/gi, "$1 [hidden]").slice(0, 300);

// Images never described, ones that failed, and ones described under older rules.
export const undescribedFilter = `metadata->ai_tags.is.null,metadata->ai_tags->>failed.eq.true,metadata->ai_tags->>v.is.null,metadata->ai_tags->>v.neq.${imageTagVersion}`;
