// Importing Pinterest boards into the Library from their public feeds: board links, the feed format, and how a pin becomes an image. Pure, so it stays testable.

export const pinterestParent = "pinterest_settings";
export type PinterestFeed = { url: string; label: string; collectionId?: string; lastSync?: string; lastError?: string; imported?: number };
export type FeedPin = { id: string; title: string; description: string; image: string; savedAt: string };

const segment = /^[\p{L}\p{N}_.%-]{1,100}$/u;

// A board link (pinterest.com/name/board/) follows that board; a profile link or bare username follows the account's recent pins.
export function feedFromInput(input: unknown): PinterestFeed | null {
  let text = typeof input === "string" ? input.trim() : "";
  if (!text) return null;
  if (!/^https?:\/\//i.test(text) && !text.includes("/")) text = `https://www.pinterest.com/${text.replace(/^@/, "")}/`;
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  let url: URL;
  try { url = new URL(text); } catch { return null; }
  if (!/(^|\.)pinterest\.[a-z.]{2,8}$/i.test(url.hostname)) return null;
  const parts = url.pathname.replace(/\.rss$/i, "").split("/").filter(Boolean);
  if (!parts.length || parts.length > 2 || !parts.every(part => segment.test(part)) || ["pin", "search", "ideas", "today", "settings"].includes(parts[0].toLowerCase())) return null;
  const [user, board] = parts;
  if (!board || board === "feed") return { url: `https://www.pinterest.com/${user}/feed.rss`, label: `${user} · recent pins` };
  return { url: `https://www.pinterest.com/${user}/${board}.rss`, label: decodeURIComponent(board).replace(/-/g, " ") };
}

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
export const decodeEntities = (text: string) => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) =>
  code[0] === "#" ? String.fromCodePoint(code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)) : entities[code.toLowerCase()] ?? whole);
const inner = (xml: string, tag: string) => {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return "";
  const cdata = match[1].match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return cdata ? cdata[1] : decodeEntities(match[1]);
};
const plain = (html: string, max: number) => decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, max);

// Pinterest's RSS: each item links to the pin and carries a small image inside its description HTML.
export function parseFeed(xml: string): { title: string; pins: FeedPin[] } {
  const channel = xml.split(/<item[\s>]/i)[0];
  const title = plain(inner(channel, "title"), 200);
  const pins: FeedPin[] = [];
  for (const block of xml.split(/<item[\s>]/i).slice(1)) {
    const item = block.split(/<\/item>/i)[0];
    const link = inner(item, "link") || inner(item, "guid");
    const id = link.match(/\/pin\/(\d{5,30})/)?.[1];
    const description = inner(item, "description");
    const image = description.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || "";
    if (!id || !/^https:\/\/i\.pinimg\.com\//.test(image)) continue;
    const savedAt = Date.parse(inner(item, "pubDate"));
    pins.push({ id, title: plain(inner(item, "title"), 200), description: plain(description, 2000), image, savedAt: Number.isFinite(savedAt) ? new Date(savedAt).toISOString() : "" });
  }
  return { title, pins };
}

// The feed gives a 236px image; the original is tried first, then the 736px size, then what the feed gave.
export function imageCandidates(url: string) {
  const match = url.match(/^(https:\/\/i\.pinimg\.com\/)[^/]+(\/.+)$/);
  return match ? [...new Set([`${match[1]}originals${match[2]}`, `${match[1]}736x${match[2]}`, url])] : [url];
}

// A title from the feed is kept unless it is empty or just repeats the description; otherwise it stays a file name for Describe to replace.
export function pinRecord(pin: FeedPin, feed: { url: string; label: string }) {
  const title = pin.title && pin.title !== pin.description ? pin.title : "";
  return {
    title: title || `pinterest-${pin.id}`,
    original_filename: `pinterest-${pin.id}`,
    metadata: { origin: "pinterest", pinterest: { pin_id: pin.id, board: feed.label, feed: feed.url, description: pin.description || null, url: `https://www.pinterest.com/pin/${pin.id}/`, saved_at: pin.savedAt || null } },
  };
}

export const feedsFrom = (meta: unknown): PinterestFeed[] => {
  const list = (meta as { feeds?: unknown } | null)?.feeds;
  return Array.isArray(list) ? list.filter((feed): feed is PinterestFeed => !!feed && typeof feed.url === "string" && typeof feed.label === "string") : [];
};

export const extensionFor = (mime: string) => ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" } as Record<string, string>)[mime] || "";
