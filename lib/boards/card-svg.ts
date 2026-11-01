// Vector layout for research cards, mirroring the on-board card CSS, so an SVG export holds
// real text and images that design apps (Illustrator, Inkscape, Figma, Penpot) can edit.
export type CardInput = { type: string; title: string; label: string; body?: string; byline?: string; detail?: string; image?: string; compact?: boolean };
export type Measure = (text: string, font: TextStyle) => number;
export type TextStyle = { family: string; size: number; weight: number; letterSpacing: number; uppercase?: boolean };
export type CardText = { x: number; y: number; lineHeight: number; style: TextStyle; color: string; lines: string[] };
export type CardLayout = {
  background?: string;
  border?: { color: string; width: number; topOnly: boolean };
  image?: { x: number; y: number; w: number; h: number; href: string };
  texts: CardText[];
};

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Arial, Helvetica, sans-serif";

/** Greedy word wrap; long words break anywhere, and a clipped last line ends with an ellipsis. */
export function wrapText(text: string, style: TextStyle, maxWidth: number, maxLines: number, measure: Measure) {
  const source = (style.uppercase ? text.toUpperCase() : text).replace(/\s+/g, " ").trim();
  if (!source || maxLines < 1) return [];
  const lines: string[] = [];
  let line = "";
  const words = source.split(" ");
  for (let i = 0; i < words.length; i++) {
    let word = words[i];
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate, style) <= maxWidth) { line = candidate; continue; }
    if (line) { lines.push(line); line = ""; if (lines.length === maxLines) return clip(lines, maxWidth, style, measure); }
    while (measure(word, style) > maxWidth && word.length > 1) {
      let cut = word.length - 1;
      while (cut > 1 && measure(word.slice(0, cut), style) > maxWidth) cut--;
      lines.push(word.slice(0, cut)); word = word.slice(cut);
      if (lines.length === maxLines) return clip(lines, maxWidth, style, measure);
    }
    line = word;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) return clip(lines.slice(0, maxLines), maxWidth, style, measure);
  return lines;
}
function clip(lines: string[], maxWidth: number, style: TextStyle, measure: Measure) {
  let last = lines[lines.length - 1];
  while (last && measure(`${last}…`, style) > maxWidth) last = last.slice(0, -1).trimEnd();
  lines[lines.length - 1] = `${last}…`;
  return lines;
}

export function layoutCard(card: CardInput, w: number, h: number, measure: Measure): CardLayout {
  const { type, compact } = card;
  const visual = !!card.image;
  const pad = visual ? { x: 13, y: 11 } : compact ? { x: 10, y: 9 } : type === "theme" ? { x: 2, y: 12 } : type === "document" ? { x: 10, y: 12 } : { x: 16, y: 14 };
  const layout: CardLayout = { texts: [] };
  if (type === "theme") layout.border = { color: "#b9bcb0", width: 1, topOnly: true };
  else if (type === "document") { layout.background = "#ffffff"; layout.border = { color: "#777b70", width: 2, topOnly: true }; }
  else { layout.background = type === "note" ? "#fcfbf6" : "#ffffff"; layout.border = { color: type === "note" ? "#e6e4da" : "#e5e4df", width: 1, topOnly: false }; }

  const inner = Math.max(20, w - pad.x * 2);
  const blocks: { gap: number; style: TextStyle; lineHeight: number; color: string; text: string; max: number }[] = [];
  if (!compact) blocks.push({ gap: 0, style: { family: SANS, size: 9, weight: 400, letterSpacing: 0.99, uppercase: true }, lineHeight: 12.6, color: "#77796f", text: card.label, max: 1 });
  const title: TextStyle = type === "theme" ? { family: SANS, size: 13, weight: 600, letterSpacing: 0.52, uppercase: true }
    : { family: SERIF, size: compact ? 14 : visual ? 16 : type === "note" ? 17 : 18, weight: 500, letterSpacing: 0 };
  blocks.push({ gap: compact ? 0 : 7, style: title, lineHeight: title.size * (type === "note" ? 1.3 : type === "theme" ? 1.4 : 1.28), color: "#292a27", text: card.title, max: compact || visual ? 2 : 3 });
  if (card.body) {
    const size = type === "note" ? 14 : 12;
    blocks.push({ gap: 6, style: { family: SANS, size, weight: 400, letterSpacing: 0 }, lineHeight: size * 1.45, color: "#292a27", text: card.body, max: 99 });
  } else if (!compact) {
    if (card.byline) blocks.push({ gap: 6, style: { family: SANS, size: 12, weight: 400, letterSpacing: 0 }, lineHeight: 17.4, color: "#292a27", text: card.byline, max: 2 });
    if (card.detail) blocks.push({ gap: 6, style: { family: SANS, size: 10, weight: 400, letterSpacing: 0 }, lineHeight: 14.5, color: "#73756b", text: card.detail, max: 2 });
  }

  // Captions on image cards take at most half the height; the image fills the rest.
  const captionMax = visual ? h * 0.5 : h;
  let y = pad.y;
  for (const block of blocks) {
    // Like the board's CSS, text may run into the bottom padding and a last line may be cut by the card edge.
    const limit = visual ? captionMax - pad.y : captionMax;
    const room = Math.floor((limit - y - block.gap + block.lineHeight * 0.4) / block.lineHeight);
    const lines = wrapText(block.text, block.style, inner, Math.min(block.max, room), measure);
    if (!lines.length) continue;
    y += block.gap;
    layout.texts.push({ x: pad.x, y, lineHeight: block.lineHeight, style: block.style, color: block.color, lines });
    y += lines.length * block.lineHeight;
  }
  if (visual && card.image) {
    const caption = Math.min(captionMax, y + pad.y);
    const imageH = Math.max(48, h - caption);
    layout.image = { x: 0, y: 0, w, h: imageH, href: card.image };
    for (const t of layout.texts) t.y += imageH;
  }
  return layout;
}
