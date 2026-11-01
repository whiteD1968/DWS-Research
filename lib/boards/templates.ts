// Board templates: slide layouts, starter boards and diagram starters, described as plain data
// so they can be tested without the canvas. The canvas turns each piece into a tldraw shape.
export type TemplateColor = "black" | "grey" | "light-violet" | "violet" | "blue" | "light-blue" | "yellow" | "orange" | "green" | "light-green" | "light-red" | "red" | "white";
export type TemplatePiece =
  | { kind: "frame"; ref: string; x: number; y: number; w: number; h: number; name: string; slide?: boolean; notes?: string }
  | { kind: "text"; ref?: string; parent?: string; x: number; y: number; w: number; text: string; size: "s" | "m" | "l" | "xl"; align?: "start" | "middle" | "end"; font?: "sans" | "serif" | "draw" | "mono"; color?: TemplateColor }
  | { kind: "placeholder"; ref?: string; parent?: string; x: number; y: number; w: number; h: number; label: string }
  | { kind: "shape"; ref?: string; parent?: string; x: number; y: number; w: number; h: number; geo: "rectangle" | "ellipse" | "diamond"; label?: string; color?: TemplateColor; fill?: "none" | "semi" | "solid"; dash?: "solid" | "dashed" | "dotted" }
  | { kind: "note"; ref?: string; parent?: string; x: number; y: number; text: string; color?: TemplateColor }
  | { kind: "box"; ref: string; parent?: string; x: number; y: number; w: number; h: number; title: string; body?: string; color?: TemplateColor }
  | { kind: "line"; parent?: string; x: number; y: number; dx: number; dy: number; dash?: "solid" | "dashed" | "dotted"; end?: "none" | "arrow" }
  | { kind: "connect"; from: string; to: string; label?: string };
export type BoardTemplate = { id: string; group: "Slide layouts" | "Decks" | "Starter boards" | "Diagrams"; label: string; description: string; pieces: TemplatePiece[] };

const SW = 1280, SH = 720, GAP = 160;
const M = 72; // slide margin

// ---------- Slide layouts: one 16:9 frame each ----------
type SlideBody = (f: string) => TemplatePiece[];
const slideBodies: Record<string, { label: string; description: string; body: SlideBody }> = {
  title: { label: "Title slide", description: "Large title, subtitle and presenter line.", body: f => [
    { kind: "text", parent: f, x: M, y: 250, w: SW - M * 2, text: "Presentation title", size: "xl", font: "serif" },
    { kind: "text", parent: f, x: M, y: 360, w: SW - M * 2, text: "Subtitle or project question", size: "m" },
    { kind: "text", parent: f, x: M, y: SH - 110, w: SW - M * 2, text: "Name · Course · Date", size: "s", color: "grey" },
  ] },
  imageCaption: { label: "Image + caption", description: "One large image with a caption column.", body: f => [
    { kind: "placeholder", parent: f, x: M, y: M, w: 760, h: SH - M * 2, label: "Image" },
    { kind: "text", parent: f, x: 880, y: M + 8, w: SW - 880 - M, text: "Heading", size: "l", font: "serif" },
    { kind: "text", parent: f, x: 880, y: M + 90, w: SW - 880 - M, text: "Caption: what this shows and why it matters.", size: "s" },
  ] },
  twoUp: { label: "Two images", description: "Side-by-side comparison with captions.", body: f => {
    const w = (SW - M * 2 - 48) / 2;
    return [
      { kind: "text", parent: f, x: M, y: 48, w: SW - M * 2, text: "Heading", size: "l", font: "serif" },
      ...[0, 1].flatMap(i => [
        { kind: "placeholder", parent: f, x: M + i * (w + 48), y: 140, w, h: 420, label: i ? "Image B" : "Image A" } as TemplatePiece,
        { kind: "text", parent: f, x: M + i * (w + 48), y: 580, w, text: "Caption", size: "s" } as TemplatePiece,
      ]),
    ];
  } },
  fourUp: { label: "Four-image grid", description: "A 2 × 2 grid for process or variations.", body: f => {
    const w = (SW - M * 2 - 32) / 2, h = (SH - 150 - M - 32) / 2;
    return [
      { kind: "text", parent: f, x: M, y: 40, w: SW - M * 2, text: "Heading", size: "l", font: "serif" },
      ...[0, 1, 2, 3].map(i => ({ kind: "placeholder", parent: f, x: M + (i % 2) * (w + 32), y: 130 + Math.floor(i / 2) * (h + 32), w, h, label: `Image ${i + 1}` } as TemplatePiece)),
    ];
  } },
  fullBleed: { label: "Full-bleed image", description: "Image fills the slide with a title over it.", body: f => [
    { kind: "placeholder", parent: f, x: 0, y: 0, w: SW, h: SH, label: "Full-bleed image" },
    { kind: "text", parent: f, x: M, y: SH - 150, w: 700, text: "Title over image", size: "xl", font: "serif" },
  ] },
  quote: { label: "Quote", description: "A pull quote with attribution.", body: f => [
    { kind: "text", parent: f, x: 140, y: 220, w: SW - 280, text: "“A quote, finding or principle that frames the work.”", size: "xl", font: "serif", align: "middle" },
    { kind: "text", parent: f, x: 140, y: 470, w: SW - 280, text: "— Source", size: "m", align: "middle", color: "grey" },
  ] },
  bullets: { label: "Heading + points", description: "Heading with three short points.", body: f => [
    { kind: "text", parent: f, x: M, y: 64, w: SW - M * 2, text: "Heading", size: "l", font: "serif" },
    ...[0, 1, 2].map(i => ({ kind: "text", parent: f, x: M, y: 200 + i * 120, w: SW - M * 2, text: `•  Point ${i + 1}`, size: "m" } as TemplatePiece)),
  ] },
};

function slide(ref: string, name: string, x: number, body: SlideBody, notes?: string): TemplatePiece[] {
  return [{ kind: "frame", ref, x, y: 0, w: SW, h: SH, name, slide: true, notes }, ...body(ref)];
}

const slideLayouts: BoardTemplate[] = Object.entries(slideBodies).map(([id, s]) => ({
  id: `slide-${id}`, group: "Slide layouts", label: s.label, description: s.description, pieces: slide("s", s.label, 0, s.body),
}));

// ---------- Decks: several slides in a row ----------
function deck(id: string, label: string, description: string, slides: [string, keyof typeof slideBodies, string?][]): BoardTemplate {
  return { id, group: "Decks", label, description, pieces: slides.flatMap(([name, body, notes], i) => slide(`s${i}`, name, i * (SW + GAP), slideBodies[body].body, notes)) };
}
const decks: BoardTemplate[] = [
  deck("deck-portfolio", "Portfolio review", "Cover, overview, process, outcome and reflection.", [
    ["Cover", "title"], ["Project overview", "imageCaption", "Brief, context and your role."], ["Process", "fourUp", "Key turns in the process."],
    ["Outcome", "fullBleed"], ["Reflection", "bullets", "What worked, what you would change, what is next."],
  ]),
  deck("deck-crit", "Crit presentation", "Question, research, concepts, direction and asks.", [
    ["Project question", "title"], ["Research", "fourUp"], ["Concept A vs B", "twoUp"], ["Direction", "imageCaption"], ["Feedback I need", "bullets"],
  ]),
];

// ---------- Starter boards ----------
// Zones are frames kept off the slide deck; they group what is dropped into them.
const zone = (ref: string, x: number, y: number, w: number, h: number, name: string): TemplatePiece => ({ kind: "frame", ref, x, y, w, h, name });
const heading = (x: number, y: number, w: number, text: string): TemplatePiece => ({ kind: "text", x, y, w, text, size: "xl", font: "serif" });

function columns(names: string[], w: number, h: number, gap: number, top: number, note?: (i: number) => TemplatePiece[]) {
  return names.flatMap((name, i) => [zone(`z${i}`, i * (w + gap), top, w, h, name), ...(note ? note(i) : [])]);
}

const starters: BoardTemplate[] = [
  { id: "start-crit", group: "Starter boards", label: "Crit pin-up", description: "Work wall with strengths, questions and next steps.", pieces: [
    heading(0, -110, 1200, "Crit pin-up"),
    zone("wall", 0, 0, 1400, 900, "Work on the wall"),
    ...[0, 1, 2, 3, 4, 5].map(i => ({ kind: "placeholder", parent: "wall", x: 40 + (i % 3) * 450, y: 60 + Math.floor(i / 3) * 410, w: 420, h: 380, label: `Pin-up ${i + 1}` } as TemplatePiece)),
    ...(["Strengths", "Questions", "Next steps"] as const).flatMap((name, i) => [
      zone(`f${i}`, 1480 + i * 440, 0, 400, 900, name),
      { kind: "note", parent: `f${i}`, x: 100, y: 70, text: i === 0 ? "What is working" : i === 1 ? "What is unclear" : "Try next", color: (["light-green", "yellow", "light-blue"] as const)[i] } as TemplatePiece,
    ]),
  ] },
  { id: "start-mood", group: "Starter boards", label: "Mood board", description: "Image grid, palette swatches and keywords.", pieces: [
    { kind: "frame", ref: "m", x: 0, y: 0, w: SW, h: SH, name: "Mood board", slide: true },
    ...[[0, 0, 500, 380], [520, 0, 360, 250], [900, 0, 308, 380], [520, 270, 360, 380], [0, 400, 500, 250], [900, 400, 308, 250]].map(([x, y, w, h], i) => ({ kind: "placeholder", parent: "m", x: M / 2 + x, y: M / 2 + y, w, h, label: `Image ${i + 1}` } as TemplatePiece)),
    { kind: "text", x: 0, y: SH + 40, w: 400, text: "Palette", size: "m", font: "serif" },
    ...(["black", "grey", "orange", "light-red", "light-blue", "light-green"] as const).map((color, i) => ({ kind: "shape", x: i * 110, y: SH + 100, w: 90, h: 90, geo: "rectangle", color, fill: "solid" } as TemplatePiece)),
    { kind: "text", x: 720, y: SH + 40, w: 400, text: "Keywords", size: "m", font: "serif" },
    ...["Texture", "Light", "Material"].map((text, i) => ({ kind: "note", x: 720 + i * 220, y: SH + 100, text, color: "yellow" } as TemplatePiece)),
  ] },
  { id: "start-process", group: "Starter boards", label: "Process wall", description: "Research to final, one zone per stage.", pieces: [
    heading(0, -110, 1600, "Process wall"),
    ...columns(["Research", "Ideation", "Development", "Refinement", "Final"], 520, 900, 40, 0),
    ...[0, 1, 2, 3].map(i => ({ kind: "line", x: 520 + i * 560 + 2, y: -40, dx: 36, dy: 0, end: "arrow" } as TemplatePiece)),
  ] },
  { id: "start-timeline", group: "Starter boards", label: "Project timeline", description: "Milestones along a line, with tasks under each.", pieces: [
    heading(0, -150, 1600, "Project timeline"),
    { kind: "line", x: 0, y: 0, dx: 2200, dy: 0, end: "arrow" },
    ...["Brief", "Research", "Concepts", "Mid-review", "Develop", "Final crit"].flatMap((name, i) => [
      { kind: "shape", x: 100 + i * 380 - 18, y: -18, w: 36, h: 36, geo: "ellipse", color: i === 3 ? "orange" : "black", fill: "solid" } as TemplatePiece,
      { kind: "text", x: 100 + i * 380 - 150, y: -90, w: 300, text: name, size: "m", align: "middle" } as TemplatePiece,
      { kind: "text", x: 100 + i * 380 - 150, y: 40, w: 300, text: `Week ${i * 2 + 1}`, size: "s", align: "middle", color: "grey" } as TemplatePiece,
      { kind: "note", x: 100 + i * 380 - 100, y: 110, text: "Task", color: "light-blue" } as TemplatePiece,
    ]),
  ] },
  { id: "start-kanban", group: "Starter boards", label: "Task board", description: "To do, doing, review and done columns.", pieces: [
    heading(0, -110, 1200, "Task board"),
    ...columns(["To do", "Doing", "Review", "Done"], 420, 1000, 40, 0, i => i === 0 ? [{ kind: "note", parent: "z0", x: 110, y: 70, text: "First task", color: "yellow" }] : []),
  ] },
  { id: "start-matrix", group: "Starter boards", label: "Opportunity matrix", description: "Impact vs effort 2 × 2 for sorting ideas.", pieces: [
    heading(0, -130, 1200, "Opportunity matrix"),
    ...([["Quick wins", "light-green"], ["Big bets", "light-blue"], ["Fill-ins", "light-violet"], ["Not now", "light-red"]] as const).map(([label, color], i) => (
      { kind: "shape", x: (i % 2) * 620, y: Math.floor(i / 2) * 520, w: 600, h: 500, geo: "rectangle", color, fill: "semi", label } as TemplatePiece)),
    { kind: "text", x: 0, y: 1060, w: 1220, text: "Effort  →", size: "m", align: "middle", color: "grey" },
    { kind: "text", x: -200, y: 480, w: 180, text: "↑  Impact", size: "m", align: "end", color: "grey" },
  ] },
  { id: "start-journey", group: "Starter boards", label: "Journey map", description: "Stages across, doing, thinking and feeling down.", pieces: [
    heading(0, -130, 1600, "Journey map"),
    ...["Discover", "Arrive", "Use", "Leave", "Return"].map((name, i) => ({ kind: "shape", x: 220 + i * 340, y: 0, w: 320, h: 70, geo: "rectangle", color: "black", fill: "solid", label: name } as TemplatePiece)),
    ...["Doing", "Thinking", "Feeling", "Opportunities"].flatMap((row, r) => [
      { kind: "text", x: 0, y: 110 + r * 240 + 90, w: 200, text: row, size: "m", font: "serif" } as TemplatePiece,
      ...[0, 1, 2, 3, 4].map(i => ({ kind: "shape", x: 220 + i * 340, y: 100 + r * 240, w: 320, h: 220, geo: "rectangle", color: r === 3 ? "orange" : "grey", fill: "none", dash: "dashed" } as TemplatePiece)),
    ]),
  ] },
];

// ---------- Diagrams: headed boxes joined by connectors ----------
const diagrams: BoardTemplate[] = [
  { id: "diagram-flow", group: "Diagrams", label: "Flow", description: "Start, steps, a decision and two outcomes.", pieces: [
    { kind: "box", ref: "a", x: 0, y: 0, w: 200, h: 120, title: "Start", body: "Trigger or entry point", color: "green" },
    { kind: "box", ref: "b", x: 320, y: 0, w: 200, h: 120, title: "Step", body: "What happens", color: "black" },
    { kind: "box", ref: "c", x: 640, y: 0, w: 200, h: 120, title: "Decision?", body: "Yes or no", color: "yellow" },
    { kind: "box", ref: "d", x: 960, y: -110, w: 200, h: 120, title: "Outcome A", color: "blue" },
    { kind: "box", ref: "e", x: 960, y: 110, w: 200, h: 120, title: "Outcome B", color: "orange" },
    { kind: "connect", from: "a", to: "b" }, { kind: "connect", from: "b", to: "c" },
    { kind: "connect", from: "c", to: "d", label: "Yes" }, { kind: "connect", from: "c", to: "e", label: "No" },
  ] },
  { id: "diagram-system", group: "Diagrams", label: "System map", description: "A central idea linked to four parts.", pieces: [
    { kind: "box", ref: "hub", x: 0, y: 0, w: 240, h: 140, title: "Core idea", body: "The system or concept", color: "violet" },
    { kind: "box", ref: "n", x: 0, y: -280, w: 220, h: 120, title: "People", color: "light-blue" },
    { kind: "box", ref: "e", x: 400, y: 10, w: 220, h: 120, title: "Places", color: "light-green" },
    { kind: "box", ref: "s", x: 10, y: 300, w: 220, h: 120, title: "Objects", color: "yellow" },
    { kind: "box", ref: "w", x: -380, y: 10, w: 220, h: 120, title: "Processes", color: "light-red" },
    ...["n", "e", "s", "w"].map(to => ({ kind: "connect", from: "hub", to } as TemplatePiece)),
  ] },
  { id: "diagram-hierarchy", group: "Diagrams", label: "Hierarchy", description: "One parent, three children, two grandchildren each.", pieces: [
    { kind: "box", ref: "r", x: 760, y: 0, w: 220, h: 110, title: "Parent", color: "black" },
    ...[0, 1, 2].flatMap(i => [
      { kind: "box", ref: `c${i}`, x: 160 + i * 610, y: 240, w: 200, h: 110, title: `Child ${i + 1}`, color: "blue" } as TemplatePiece,
      { kind: "connect", from: "r", to: `c${i}` } as TemplatePiece,
      ...[0, 1].flatMap(j => [
        { kind: "box", ref: `g${i}${j}`, x: 40 + i * 610 + j * 240, y: 470, w: 200, h: 100, title: `Item ${i + 1}.${j + 1}`, color: "light-blue" } as TemplatePiece,
        { kind: "connect", from: `c${i}`, to: `g${i}${j}` } as TemplatePiece,
      ]),
    ]),
  ] },
];

export const TEMPLATES: BoardTemplate[] = [...slideLayouts, ...decks, ...starters, ...diagrams];
export const TEMPLATE_GROUPS = ["Slide layouts", "Decks", "Starter boards", "Diagrams"] as const;

/** Bounds of a template's top-level pieces (children sit inside their frames). */
export function templateBounds(pieces: TemplatePiece[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pieces) {
    if (p.kind === "connect" || ("parent" in p && p.parent)) continue;
    const w = p.kind === "line" ? p.dx : p.kind === "note" ? 200 : p.w;
    const h = p.kind === "line" ? p.dy : p.kind === "note" ? 200 : p.kind === "text" ? (p.size === "xl" ? 60 : 40) : p.h;
    minX = Math.min(minX, p.x, p.x + w); minY = Math.min(minY, p.y, p.y + h);
    maxX = Math.max(maxX, p.x, p.x + w); maxY = Math.max(maxY, p.y, p.y + h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Where to drop a template: centred on the view, or to the right of existing slides for slide templates. */
export function templateOrigin(bounds: { x: number; y: number; w: number; h: number }, view: { x: number; y: number }, slidesRight?: { x: number; y: number }) {
  if (slidesRight) return { x: Math.round(slidesRight.x - bounds.x), y: Math.round(slidesRight.y - bounds.y) };
  return { x: Math.round(view.x - bounds.w / 2 - bounds.x), y: Math.round(view.y - bounds.h / 2 - bounds.y) };
}

// ---------- Saved templates (the user's own, kept in this browser) ----------
export type SavedTemplate = { id: string; name: string; created: string; content: unknown; count: number };
export const SAVED_KEY = "dws-board-templates";
export const SAVED_LIMIT = 40;
export const SAVED_MAX_BYTES = 400_000;

export function parseSaved(raw: string | null): SavedTemplate[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((t): t is SavedTemplate => !!t && typeof t.id === "string" && typeof t.name === "string" && !!t.content && typeof t.content === "object") : [];
  } catch { return []; }
}

type ContentShape = { id: string; type: string; parentId: string; meta?: Record<string, unknown>; props?: Record<string, unknown> };
type ContentBinding = { fromId: string; toId: string };
/**
 * Keep a template to layout and drawing: research cards and Theme frames point at records that
 * belong to one board, and images are stored as cards, so those (and anything inside them) are left out.
 */
export function stripForTemplate<T extends { shapes: ContentShape[]; bindings?: ContentBinding[]; rootShapeIds: string[]; assets?: unknown[] }>(content: T) {
  const linked = (s: ContentShape) => s.type === "research-record" || s.type === "image" || s.type === "video" || typeof s.meta?.recordKey === "string";
  const dropped = new Set(content.shapes.filter(linked).map(s => s.id));
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of content.shapes) if (!dropped.has(s.id) && dropped.has(s.parentId)) { dropped.add(s.id); grew = true; }
  }
  // Slide order belongs to the board a template came from; inserted frames join the end of the deck.
  const shapes = content.shapes.filter(s => !dropped.has(s.id)).map(s => {
    if (!s.meta || !("slideIndex" in s.meta)) return s;
    const meta = { ...s.meta };
    delete meta.slideIndex;
    return { ...s, meta };
  });
  return {
    content: { ...content, shapes, bindings: (content.bindings ?? []).filter(b => !dropped.has(b.fromId) && !dropped.has(b.toId)), rootShapeIds: content.rootShapeIds.filter(id => !dropped.has(id)), assets: [] },
    kept: shapes.length, left: dropped.size,
  };
}

type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** Keep a new template off existing work: if its spot is taken, start it below everything on the board. */
export function clearOrigin(bounds: Rect, origin: { x: number; y: number }, occupied: Rect[], gap = 240) {
  const spot = { x: origin.x + bounds.x, y: origin.y + bounds.y, w: bounds.w, h: bounds.h };
  if (!occupied.some(r => overlaps(spot, r))) return origin;
  const left = Math.min(...occupied.map(r => r.x)), bottom = Math.max(...occupied.map(r => r.y + r.h));
  return { x: Math.round(left - bounds.x), y: Math.round(bottom + gap - bounds.y) };
}
