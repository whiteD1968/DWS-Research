// Describing images with Claude: the request schema, the prompt, and cleanup of what comes back. Pure, so it stays testable.

export const imageTagModel = "claude-opus-5-5";
export const maxImageTags = 6;
export type ImageDescription = { caption: string; altText: string; tags: string[] };
export type AiTagRecord = { tags?: string[]; caption?: string; alt_text?: string; model?: string; at?: string; failed?: boolean };

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
Give three to six tags of one to three lowercase words each. Favour what a maker would search for: subject, material or medium, technique or process, form, and setting (for example "ceramics", "glaze test", "wheel-thrown", "vessel", "studio", "sketch", "installation view", "archival photo", "diagram"). Reuse a tag from the existing list whenever one fits instead of inventing a near-synonym.`;

export function imageTagPrompt(existing: string[], title: string) {
  const known = existing.slice(0, 150).join(", ");
  return [title ? `File title: ${title}` : "", known ? `Existing tags in this library: ${known}` : "Existing tags in this library: none yet", "Describe this image."].filter(Boolean).join("\n");
}

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
  const tags = [...new Set((Array.isArray(value.tags) ? value.tags : []).map(tag => normalizeTag(tag, existing)).filter(Boolean))].slice(0, maxImageTags);
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
