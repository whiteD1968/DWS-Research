// The research map is a transit-style diagram of Dustin's research: strands (thick lines) coloured by axis,
// stations on them, and the people, ideas and techniques that feed each strand.
// Content and layout are stored together as plain data; the drawing is always generated from it,
// so the map keeps one visual language however often it is edited.

export const researchMapParent = "research_map";
export const researchMapSnapshotParent = "research_map_snapshot";

// The three starting categories; a map can rename them and add more.
export const axes = ["material", "structure", "computation"] as const;
export type Axis = string;
export const axisIds = (map: Pick<ResearchMap, "axes">) => Object.keys(map.axes);
export const kinds = ["concept", "technique", "person", "output"] as const;
export type Kind = (typeof kinds)[number];
export const kindLabels: Record<Kind, string> = { concept: "Concept or precedent", technique: "Technique or tool", person: "Person or group", output: "Output" };
export const markers = ["none", "start", "stop", "interchange", "outcome"] as const;
export type MarkerType = (typeof markers)[number];
export const markerLabels: Record<MarkerType, string> = { none: "No station", start: "Strand begins", stop: "Method or milestone", interchange: "Interchange: strands combine", outcome: "Outcome (strand ends)" };
export const routes = ["under", "end", "start", "level"] as const;
export type Route = (typeof routes)[number];
export const routeLabels: Record<Route, string> = { under: "Under the label, then 45°", end: "From the label's end", start: "From the label's start", level: "Level, then 45° at the strand" };

export type Pt = [number, number];
export interface Strand { id: string; axis: Axis; points: Pt[]; color?: string }
// Per-station overrides; anything left out follows the map style.
export interface MarkerPaint { fill?: string; stroke?: string; scale?: number; weight?: number }
export interface Marker { type: MarkerType; x: number; y: number; y2?: number; strand?: string; paint?: MarkerPaint }
// Free shapes drawn on the map, such as translucent planes behind the strands or circles over them.
export const shapeKinds = ["polygon", "ellipse", "line", "text"] as const;
// Line ends for leaders, arrows and dimensions.
export const lineEnds = ["none", "arrow", "circle", "dot", "tick", "bar"] as const;
export type LineEnd = (typeof lineEnds)[number];
export interface Shape {
  id: string; name: string; kind: (typeof shapeKinds)[number]; points: Pt[];
  fill: string; opacity: number; hatch: (typeof hatches)[number];
  stroke: string; strokeWidth: number; outline: (typeof outlines)[number];
  front?: boolean; hidden?: boolean;
  hatchColor?: string; hatchOpacity?: number; shadow?: boolean;
  // Lines: ends and whether the line curves through its points.
  start?: LineEnd; end?: LineEnd; curve?: boolean;
  // Text: the words, drawn to fill the shape's box; outlined lettering if wanted.
  text?: string; outlined?: boolean; weight?: number;
}
export interface Feed { strand: string; at: Pt; route: Route }
// Text overrides; anything left out follows the map style.
export interface TextPaint { color?: string; scale?: number; bold?: boolean; italic?: boolean }
export interface Item {
  id: string; name: string; kind: Kind; main: boolean;
  x: number; y: number; anchor: "start" | "middle" | "end";
  marker?: Marker; feeds?: Feed; from?: string; paint?: TextPaint;
}
// Every other piece of text on the map, each with its own color and size.
export const textRoles = ["title", "axesLine", "subtitle", "columnTitle", "columnNote", "zoneTitle", "legendHead", "legend", "caption", "concept", "technique", "person", "output", "project"] as const;
export type TextRole = (typeof textRoles)[number];
export const textRoleLabels: Record<TextRole, string> = { title: "Map title", axesLine: "Category line under the title", subtitle: "Subtitle", columnTitle: "Column titles", columnNote: "Column notes", zoneTitle: "Core zone title", legendHead: "Legend headings", legend: "Legend text", caption: "How-to-read text", concept: "Concepts and precedents", technique: "Techniques and tools", person: "People and groups", output: "Outputs", project: "Project codes" };
// Default colors; an empty one means the style's ink.
export const textDefaults: Record<TextRole, string> = { title: "", axesLine: "", subtitle: "#6b6b6b", columnTitle: "#9a9a96", columnNote: "#9a9a96", zoneTitle: "", legendHead: "", legend: "", caption: "#333333", concept: "#3a3a3a", technique: "#3a3a3a", person: "#6b6b6b", output: "#3a3a3a", project: "" };
// Wording in the legend that isn't stored elsewhere.
export const legendWords = { read: "HOW TO READ THIS", axes: "AXES", stations: "STATIONS", type: "TYPE", projects: "MY PROJECTS", influence: "Influence feeding a strand", start: markerLabels.start, stop: markerLabels.stop, interchange: markerLabels.interchange, outcome: markerLabels.outcome, concept: kindLabels.concept, technique: kindLabels.technique, person: kindLabels.person, output: kindLabels.output, placeholder: "Project station still to name" } as const;
export type LegendWord = keyof typeof legendWords;
export interface Project { id: string; code: string; name: string; projectId?: string; x: number; y: number; note?: string; color?: string }
export interface Column { title: string; subtitle: string; x0: number; x1: number }
export interface ResearchMap {
  version: 1; width: number; height: number;
  title: string; subtitle: string;
  axes: Record<Axis, { label: string; color: string }>;
  columns: Column[];
  zone: { x: number; y: number; w: number; h: number; title: string } | null;
  strands: Strand[]; items: Item[]; projects: Project[];
  caption: string;
  style?: MapStyle;
  shapes?: Shape[];
  text?: Partial<Record<TextRole, TextPaint>>;
  words?: Partial<Record<LegendWord, string>>;
  stylePresets?: { name: string; style: MapStyle }[];
}

// ---------- graphic style ----------
// One style governs the whole drawing, so every line and label stays in the same language.
export const grounds = ["plain", "ledger", "grid", "dots", "dashed"] as const;
export const strandDashes = ["solid", "dash", "long"] as const;
export const influenceDashes = ["dash", "dot", "solid"] as const;
export const fills = ["white", "stripes", "black"] as const;
export const hatches = ["none", "stripes", "lines", "heavy", "chevrons", "grid", "dots", "cross"] as const;
export const outlines = ["solid", "dashed", "none"] as const;
export const fonts = ["helvetica", "inter", "condensed", "mono"] as const;
export const fontLabels: Record<(typeof fonts)[number], string> = { helvetica: "Helvetica", inter: "Inter", condensed: "Condensed sans", mono: "Monospace (drafting)" };
export const fontStacks: Record<(typeof fonts)[number], string> = {
  helvetica: "'Helvetica Neue', Helvetica, Inter, Arial, sans-serif",
  inter: "Inter, 'Helvetica Neue', Arial, sans-serif",
  condensed: "'Helvetica Neue Condensed', 'Roboto Condensed', 'Arial Narrow', 'Inter Display', sans-serif-condensed, sans-serif",
  mono: "'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace",
};
export interface MapStyle {
  ground: (typeof grounds)[number]; background: string; rule: string; bands: number;
  strandWidth: number; corner: number; strandDash: (typeof strandDashes)[number]; casing: boolean;
  influenceWidth: number; influenceDash: (typeof influenceDashes)[number]; influenceOpacity: number; influenceInk: boolean;
  stationScale: number; stationStroke: number; interchangeFill: (typeof fills)[number];
  font: (typeof fonts)[number]; textScale: number; ink: string;
  zoneFill: string; zoneOpacity: number; zoneHatch: (typeof hatches)[number]; zoneOutline: (typeof outlines)[number];
  construction: boolean; planes: boolean;
  // The section scale: a tick ruler across the top with registration crosses where the columns divide.
  scale: boolean;
}
export const defaultStyle: MapStyle = {
  ground: "plain", background: "#EDEDEB", rule: "#c9c9c5", bands: 0.025,
  strandWidth: 6, corner: 30, strandDash: "solid", casing: true,
  influenceWidth: 1.4, influenceDash: "dash", influenceOpacity: 0.55, influenceInk: false,
  stationScale: 1, stationStroke: 1, interchangeFill: "white",
  font: "helvetica", textScale: 1, ink: "#1d1d1f",
  zoneFill: "#F6D78B", zoneOpacity: 0.45, zoneHatch: "none", zoneOutline: "solid",
  construction: false, planes: false, scale: false,
};
type AxisColors = Record<Axis, string>;
export const stylePresets: { key: string; name: string; note: string; style: MapStyle; colors?: AxisColors }[] = [
  { key: "transit", name: "Transit", note: "Clean, colored lines on a light ground. Reads well on screen and in print.", style: defaultStyle, colors: { material: "#C4572B", structure: "#2459A8", computation: "#8E3B8F" } },
  { key: "portfolio", name: "Portfolio original", note: "Close to the first portfolio drawing: fine dashed lines and small stations on grey.", colors: { material: "#2b2b2b", structure: "#4a4a4a", computation: "#111111" },
    style: { ...defaultStyle, background: "#E9E9E7", bands: 0, strandWidth: 3, corner: 34, strandDash: "dash", casing: false, influenceWidth: 0.9, influenceDash: "dash", influenceOpacity: 0.45, influenceInk: true, stationScale: 0.7, stationStroke: 0.8, zoneFill: "#ffffff", zoneOpacity: 0.5, zoneOutline: "dashed" } },
  { key: "ledger", name: "Ledger drawing", note: "After Bryan Cantley's layered drawings: green ledger ground, hairline construction lines and registration marks, translucent planes, hazard-striped core and interchanges, condensed type.", colors: { material: "#E0643C", structure: "#161616", computation: "#4C7DA6" },
    style: { ground: "ledger", background: "#E3ECDD", rule: "#B7CCB0", bands: 0, strandWidth: 5, corner: 18, strandDash: "solid", casing: true, influenceWidth: 0.8, influenceDash: "solid", influenceOpacity: 0.75, influenceInk: false, stationScale: 1, stationStroke: 1.1, interchangeFill: "stripes", font: "condensed", textScale: 1, ink: "#141414", zoneFill: "#F2A890", zoneOpacity: 0.45, zoneHatch: "stripes", zoneOutline: "none", construction: true, planes: true, scale: true } },
  { key: "blueprint", name: "Drafting grid", note: "Monospace lettering on a fine grid, with construction lines and white interchanges.", colors: { material: "#C8502A", structure: "#1F3F73", computation: "#6A3B8C" },
    style: { ...defaultStyle, ground: "grid", background: "#F4F3EE", rule: "#D9D6CC", bands: 0.02, strandWidth: 4, corner: 12, font: "mono", textScale: 0.92, construction: true, scale: true, zoneHatch: "chevrons", zoneFill: "#F3C46A", zoneOpacity: 0.35, zoneOutline: "dashed" } },
  { key: "plan", name: "Plan collage", note: "After the pink plan collage: white sheet on a fine grid with a dot field, pink and black heavy hatching, thin black lines and dashed edges.", colors: { material: "#C46FA9", structure: "#141414", computation: "#8A8A8A" },
    style: { ...defaultStyle, ground: "dots", background: "#FBFBFA", rule: "#D8D8D6", bands: 0, strandWidth: 3.5, corner: 40, casing: true, influenceWidth: 0.9, influenceDash: "solid", influenceOpacity: 0.7, influenceInk: true, stationScale: 0.95, stationStroke: 0.9, interchangeFill: "stripes", font: "helvetica", ink: "#141414", zoneFill: "#E7B4D6", zoneOpacity: 0.6, zoneHatch: "heavy", zoneOutline: "dashed", construction: false, planes: false } },
  { key: "collimator", name: "Collimator sheet", note: "After Cantley's “2:34” sheet: salmon field, mint graph-paper plates, orange construction lines, condensed bold lettering.", colors: { material: "#E0662E", structure: "#1C1C1C", computation: "#4E9C7E" },
    style: { ...defaultStyle, ground: "plain", background: "#ECEBE6", rule: "#C9C7BF", bands: 0, strandWidth: 5, corner: 10, casing: true, influenceWidth: 0.8, influenceDash: "solid", influenceOpacity: 0.65, stationStroke: 1.2, interchangeFill: "black", font: "condensed", ink: "#161616", zoneFill: "#D9776F", zoneOpacity: 0.6, zoneHatch: "grid", zoneOutline: "none", construction: true, planes: false, scale: true } },
  { key: "sheet", name: "Drafting sheet", note: "After the dashed-grid drafting sheet: dashed grid with a measured scale, hairline strands, small monospace notes.", colors: { material: "#555555", structure: "#1E1E1E", computation: "#1F5FA8" },
    style: { ...defaultStyle, ground: "dashed", background: "#FFFFFF", rule: "#BDBDBD", bands: 0, strandWidth: 2.5, corner: 0, casing: false, influenceWidth: 0.7, influenceDash: "dash", influenceOpacity: 0.6, influenceInk: true, stationScale: 0.8, stationStroke: 0.7, interchangeFill: "white", font: "mono", textScale: 0.9, ink: "#222222", zoneFill: "#DDE6F2", zoneOpacity: 0.5, zoneHatch: "lines", zoneOutline: "dashed", construction: false, planes: false, scale: true } },
];
export function styleOf(map: Pick<ResearchMap, "style">): MapStyle { return map.style || defaultStyle; }

export interface Metrics { scale: number; wide: number; kinds?: Partial<Record<Kind, number>> }
export const defaultMetrics: Metrics = { scale: 1, wide: 1 };
export function metricsFor(style: MapStyle, text?: ResearchMap["text"]): Metrics {
  const kinds = text ? Object.fromEntries(kindsList.flatMap(k => text[k]?.scale ? [[k, text[k]!.scale!]] : [])) : {};
  return { scale: style.textScale, wide: style.font === "condensed" ? 0.94 : style.font === "mono" ? 1.18 : style.font === "inter" ? 1.04 : 1, ...(Object.keys(kinds).length ? { kinds } : {}) };
}
const kindsList = ["concept", "technique", "person", "output"] as const;
export const metricsOf = (map: Pick<ResearchMap, "style" | "text">) => metricsFor(styleOf(map), map.text);
// A text role's paint, with its default color and the style's ink filled in.
export function rolePaint(map: Pick<ResearchMap, "style" | "text">, role: TextRole) {
  const p = map.text?.[role] || {}; const ink = styleOf(map).ink;
  return { color: p.color || textDefaults[role] || ink, scale: p.scale ?? 1, bold: p.bold, italic: p.italic };
}

export const INK = "#1d1d1f";
export const MUTED = "#6b6b6b";
export const BG = "#EDEDEB";
export const FONT = "'Helvetica Neue', Helvetica, Inter, Arial, sans-serif";
export const MAP_TOP = 170;
export const MAP_BOTTOM = 1280;

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r1 = (n: number) => Math.round(n * 10) / 10;

// ---------- geometry ----------

export function labelSize(item: Pick<Item, "main" | "kind"> & { paint?: TextPaint }, t: Metrics = defaultMetrics) {
  const size = item.main ? 21 : 14;
  return (item.kind === "technique" ? size - (item.main ? 2 : 2.5) : item.kind === "person" ? size - 1 : size) * t.scale * (t.kinds?.[item.kind] ?? 1) * (item.paint?.scale ?? 1);
}
export function labelLines(name: string) { return name.split("\n").map(line => line.trim()).filter(Boolean); }

// Estimated text width; the drawing is generated without a browser, so this stays deliberately generous.
export function labelWidth(item: Pick<Item, "name" | "main" | "kind"> & { paint?: TextPaint }, t: Metrics = defaultMetrics) {
  const size = labelSize(item, t) * t.wide;
  const per = item.kind === "technique" ? (item.main ? 0.74 : 0.7) : item.kind === "person" ? 0.5 : item.main ? 0.56 : 0.53;
  return Math.max(...labelLines(item.name || " ").map(line => line.length), 1) * size * per;
}

export interface Box { x0: number; y0: number; x1: number; y1: number }
export function labelBox(item: Item, t: Metrics = defaultMetrics): Box {
  const width = labelWidth(item, t); const size = labelSize(item, t); const lines = Math.max(labelLines(item.name).length, 1);
  const x0 = item.anchor === "start" ? item.x : item.anchor === "end" ? item.x - width : item.x - width / 2;
  const pad = item.kind === "output" ? (item.main ? 7 : 5) : 0;
  return { x0: x0 - pad, y0: item.y - size * 0.8 - pad, x1: x0 + width + pad, y1: item.y + size * 1.2 * (lines - 1) + size * 0.25 + pad };
}

export function nearestOnPolyline(points: Pt[], p: Pt): { point: Pt; distance: number } {
  let best: { point: Pt; distance: number } = { point: points[0], distance: Infinity };
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]; const [bx, by] = points[i];
    const dx = bx - ax; const dy = by - ay; const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len)) : 0;
    const q: Pt = [ax + dx * t, ay + dy * t];
    const distance = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (distance < best.distance) best = { point: [r1(q[0]), r1(q[1])], distance };
  }
  return best;
}

// Snaps a point so the segment from `from` runs at 0°, 45° or 90°, on a 5-unit grid.
export function snapDirection(from: Pt, to: Pt, grid = 5): Pt {
  const dx = to[0] - from[0]; const dy = to[1] - from[1];
  const angle = Math.atan2(dy, dx); const step = Math.PI / 4;
  const snapped = Math.round(angle / step) * step;
  const length = Math.hypot(dx, dy) * Math.cos(angle - snapped);
  let x = from[0] + Math.cos(snapped) * length; let y = from[1] + Math.sin(snapped) * length;
  const g = (n: number) => Math.round(n / grid) * grid;
  if (Math.abs(Math.sin(snapped)) < 1e-6) { x = g(x); y = from[1]; }
  else if (Math.abs(Math.cos(snapped)) < 1e-6) { x = from[0]; y = g(y); }
  else { const d = g(Math.abs(x - from[0])); x = from[0] + Math.sign(Math.cos(snapped)) * d; y = from[1] + Math.sign(Math.sin(snapped)) * d; }
  return [r1(x), r1(y)];
}

// Places a bend between two neighbours so both of its segments stay at 0°, 45° or 90°, as close to the pointer as possible.
export function snapBetween(prev: Pt, next: Pt, to: Pt): Pt {
  const dirs: Pt[] = [[1, 0], [0, 1], [1, 1], [1, -1]];
  let best: { p: Pt; d: number } | null = null;
  for (const a of dirs) for (const b of dirs) {
    const det = a[0] * -b[1] - a[1] * -b[0];
    if (Math.abs(det) < 1e-9) continue;
    const rx = next[0] - prev[0]; const ry = next[1] - prev[1];
    const t = (rx * -b[1] - ry * -b[0]) / det;
    const p: Pt = [r1(prev[0] + a[0] * t), r1(prev[1] + a[1] * t)];
    const d = Math.hypot(p[0] - to[0], p[1] - to[1]);
    if (!best || d < best.d) best = { p, d };
  }
  return best && best.d < 160 ? best.p : snapDirection(prev, to);
}

export function segmentAngleOk(a: Pt, b: Pt) {
  const dx = Math.abs(b[0] - a[0]); const dy = Math.abs(b[1] - a[1]);
  return dx < 0.6 || dy < 0.6 || Math.abs(dx - dy) <= Math.max(2, 0.03 * Math.max(dx, dy));
}

function roundedPath(input: Pt[], radius: number) {
  const pts: Pt[] = [];
  for (const p of input) { const last = pts[pts.length - 1]; if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.5) pts.push(p); }
  if (!pts.length) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [p0, p1, p2] = [pts[i - 1], pts[i], pts[i + 1]];
    const v1 = [p1[0] - p0[0], p1[1] - p0[1]]; const v2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(v1[0], v1[1]); const l2 = Math.hypot(v2[0], v2[1]);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    d += ` L${r1(p1[0] - v1[0] / l1 * r)},${r1(p1[1] - v1[1] / l1 * r)} Q${p1[0]},${p1[1]} ${r1(p1[0] + v2[0] / l2 * r)},${r1(p1[1] + v2[1] / l2 * r)}`;
  }
  const end = pts[pts.length - 1];
  return d + ` L${end[0]},${end[1]}`;
}

export function feedPath(item: Item, feed: Feed, t: Metrics = defaultMetrics): Pt[] {
  const width = labelWidth(item, t); const sy = item.y + 7;
  const sx = item.anchor === "start" ? item.x : item.anchor === "end" ? item.x - width : item.x - width / 2;
  const [tx, ty] = feed.at;
  if (feed.route === "end") return [[sx, sy], [sx + width, sy], [tx, ty]];
  if (feed.route === "start") return [[sx + width, sy], [sx, sy], [tx, ty]];
  const dy = Math.abs(ty - sy);
  if (feed.route === "level") { const bx = Math.max(sx + width, tx - dy); return [[sx, sy], [sx + width, sy], [bx, sy], [tx, ty]]; }
  const bx = Math.max(tx - dy, sx + width);
  return [[sx, sy], [bx, sy], [tx, ty]];
}

export function branchPath(item: Item, parent: Item, t: Metrics = defaultMetrics): Pt[] {
  const box = labelBox(parent, t); const px = Math.min(box.x1 - 30, Math.max(box.x0 + 30, item.x));
  return [[item.x - 7, item.y - 6], [item.x - 22, item.y - 6], [item.x - 22, box.y1 + 12], [px, box.y1 + 12], [px, box.y1]];
}

// ---------- drawing ----------

// Text with a role's paint applied: color, size, bold and italic.
function roleText(map: ResearchMap, role: TextRole, x: number, y: number, s: string, o: { size: number; weight?: number; anchor?: string; italic?: boolean; spacing?: number; caps?: boolean; fill?: string }) {
  const p = rolePaint(map, role); const set = map.text?.[role];
  return textSvg(x, y, s, { ...o, size: o.size * p.scale, fill: set?.color ? set.color : o.fill ?? p.color, weight: set?.bold === undefined ? o.weight : set.bold ? 800 : 400, italic: set?.italic === undefined ? o.italic : set.italic });
}
// Approximate width of a run of text, for selecting it on the canvas.
export function textExtent(s: string, size: number, t: Metrics = defaultMetrics, caps = false) {
  return Math.max(...labelLines(s || " ").map(l => l.length), 1) * size * t.wide * (caps ? 0.68 : 0.55);
}
function textSvg(x: number, y: number, s: string, o: { size: number; weight?: number; fill?: string; anchor?: string; italic?: boolean; spacing?: number; caps?: boolean }) {
  const lines = labelLines(s); const step = o.size * 1.2;
  const body = lines.map((line, i) => `<tspan x="${x}" dy="${i ? step : 0}">${esc(o.caps ? line.toUpperCase() : line)}</tspan>`).join("");
  return `<text x="${x}" y="${y}" font-size="${o.size}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? INK}" text-anchor="${o.anchor ?? "start"}"${o.italic ? ' font-style="italic"' : ""}${o.spacing ? ` letter-spacing="${o.spacing}"` : ""}>${body}</text>`;
}

// role: the map's paint for this kind of label; item.paint overrides it for one label.
export function labelSvg(item: Pick<Item, "name" | "kind" | "main" | "x" | "y" | "anchor"> & { paint?: TextPaint }, t: Metrics = defaultMetrics, ink = INK, role: TextPaint = {}) {
  const size = labelSize(item, t); const own = item.paint || {};
  const bold = own.bold ?? role.bold; const italic = own.italic ?? role.italic;
  const weight = bold === undefined ? (item.main ? 700 : 400) : bold ? 700 : 400;
  const base = item.kind === "person" ? MUTED : item.main ? ink : "#3a3a3a";
  const fill = own.color || role.color || base;
  if (item.kind === "technique") return textSvg(item.x, item.y, item.name, { size, weight, fill, anchor: item.anchor, spacing: item.main ? 1.6 : 1.2, caps: true, italic });
  if (item.kind === "person") return textSvg(item.x, item.y, item.name, { size, weight, fill, anchor: item.anchor, italic: italic ?? true });
  if (item.kind === "output") {
    const box = labelBox(item as Item, t);
    return `<rect x="${r1(box.x0)}" y="${r1(box.y0)}" width="${r1(box.x1 - box.x0)}" height="${r1(box.y1 - box.y0)}" fill="#fff" fill-opacity="0.55" stroke="${own.color || ink}" stroke-width="${item.main ? 1.6 : 1}"/>` + textSvg(item.x, item.y, item.name, { size, weight, fill, anchor: item.anchor, italic });
  }
  return textSvg(item.x, item.y, item.name, { size, weight, fill, anchor: item.anchor, italic });
}

export function strandColor(map: ResearchMap, strandId?: string) {
  const strand = map.strands.find(s => s.id === strandId);
  return strand ? strandInk(map, strand) : styleOf(map).ink;
}
export function strandInk(map: Pick<ResearchMap, "axes" | "style">, strand: Strand) {
  return strand.color || map.axes[strand.axis]?.color || styleOf(map).ink;
}

const interchangePaint = (style: MapStyle) => style.interchangeFill === "stripes" ? "url(#rm-stripes)" : style.interchangeFill === "black" ? style.ink : "#fff";

export const markerFills = ["", "white", "stripes", "color", "none"] as const;
export const markerFillLabels: Record<(typeof markerFills)[number], string> = { "": "Follow the map style", white: "White", stripes: "Hazard stripes", color: "Solid color", none: "No fill" };
// Which of markerFills a stored fill value is: "", "white", "stripes", "none", or a hex color.
export const markerFillKind = (fill?: string): (typeof markerFills)[number] => !fill ? "" : fill === "white" || fill === "stripes" || fill === "none" ? fill : "color";

export function markerSvg(type: MarkerType, x: number, y: number, color: string, y2?: number, style: MapStyle = defaultStyle, paint: MarkerPaint = {}, key = "") {
  const span = y2 !== undefined && Math.abs(y2 - y) > 1;
  const top = span ? Math.min(y, y2!) : y; const bottom = span ? Math.max(y, y2!) : y;
  const k = style.stationScale * (paint.scale ?? 1); const w = style.stationStroke * (paint.weight ?? 1);
  const ink = paint.stroke || style.ink; const line = paint.stroke || color;
  // A custom outline color gets its own stripe pattern so the stripes match it.
  const stripes = paint.stroke && key ? `rm-stripes-${key}` : "rm-stripes";
  const defs = stripes !== "rm-stripes" ? `<defs><pattern id="${stripes}" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="#fff"/><rect width="7" height="14" fill="${paint.stroke}"/></pattern></defs>` : "";
  const fill = (fallback: string) => !paint.fill ? fallback : paint.fill === "white" ? "#fff" : paint.fill === "stripes" ? `url(#${stripes})` : paint.fill === "none" ? "none" : paint.fill;
  if (type === "start") return `<circle cx="${x}" cy="${y}" r="${9 * k}" fill="${paint.stroke || color}"/><circle cx="${x}" cy="${y}" r="${4 * k}" fill="${fill("#fff")}"/>`;
  if (type === "stop") return defs + `<circle cx="${x}" cy="${y}" r="${8 * k}" fill="${fill("#fff")}" stroke="${line}" stroke-width="${3 * w}"/>`;
  if (type === "interchange") return defs + `<rect x="${x - 15 * k}" y="${top - 15 * k}" width="${30 * k}" height="${bottom - top + 30 * k}" rx="${15 * k}" fill="${fill(interchangePaint(style))}" stroke="${ink}" stroke-width="${3.5 * w}"/>`;
  if (type === "outcome") return defs + (span
    ? `<rect x="${x - 15 * k}" y="${top - 13 * k}" width="${30 * k}" height="${bottom - top + 26 * k}" rx="${15 * k}" fill="${fill("#fff")}" stroke="${line}" stroke-width="${5 * w}"/>`
    : `<circle cx="${x}" cy="${y}" r="${10 * k}" fill="${fill("#fff")}" stroke="${line}" stroke-width="${5 * w}"/>`);
  return "";
}

// The area a station covers, for selecting it on the canvas.
export function markerBox(marker: Marker, style: MapStyle = defaultStyle) {
  const k = style.stationScale * (marker.paint?.scale ?? 1) + 0.15;
  const span = marker.y2 !== undefined && Math.abs(marker.y2 - marker.y) > 1;
  const top = span ? Math.min(marker.y, marker.y2!) : marker.y; const bottom = span ? Math.max(marker.y, marker.y2!) : marker.y;
  const r = (marker.type === "interchange" || (marker.type === "outcome" && span) ? 15 : marker.type === "outcome" ? 11 : 9) * k;
  return { x0: marker.x - r, y0: top - r, x1: marker.x + r, y1: bottom + r, r };
}

export function projectSvg(project: Pick<Project, "x" | "y" | "code" | "name" | "color">, ink = INK, text: { color?: string; scale?: number } = {}) {
  const named = !!project.name.trim();
  return `<g><circle cx="${project.x}" cy="${project.y}" r="17" fill="${project.color || (named ? "#F6D78B" : "#fff")}" stroke="${ink}" stroke-width="2"${named ? "" : ' stroke-dasharray="4 3"'}/>` +
    `<text x="${project.x}" y="${project.y + 5}" font-size="${14 * (text.scale ?? 1)}" font-weight="800" fill="${text.color || ink}" text-anchor="middle">${esc(project.code)}</text></g>`;
}

const strandDash = (style: MapStyle) => style.strandDash === "dash" ? `${style.strandWidth * 3} ${style.strandWidth * 1.6}` : style.strandDash === "long" ? `${style.strandWidth * 6} ${style.strandWidth * 1.8}` : "";
const influenceDash = (style: MapStyle) => style.influenceDash === "dash" ? "7 5" : style.influenceDash === "dot" ? `0.1 ${Math.max(3, style.influenceWidth * 3.5)}` : "";
const dashAttr = (d: string, round = false) => d ? ` stroke-dasharray="${d}"${round ? ' stroke-linecap="round"' : ""}` : "";

// A fill pattern drawn in any color, for shapes and the core zone.
export function hatchPattern(id: string, hatch: (typeof hatches)[number], color: string, opacity = 0.16) {
  const o = `fill-opacity="${opacity}"`; const so = `stroke-opacity="${opacity}"`;
  if (hatch === "stripes") return `<pattern id="${id}" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="9" height="26" fill="${color}" ${o}/></pattern>`;
  if (hatch === "lines") return `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="1.4" height="8" fill="${color}" ${o}/></pattern>`;
  if (hatch === "heavy") return `<pattern id="${id}" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="8" height="18" fill="${color}" ${o}/></pattern>`;
  if (hatch === "chevrons") return `<pattern id="${id}" width="44" height="30" patternUnits="userSpaceOnUse"><path d="M0,0 L22,15 L0,30 M22,0 L44,15 L22,30" fill="none" stroke="${color}" ${so} stroke-width="9"/></pattern>`;
  if (hatch === "grid") return `<pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12,0H0V12" fill="none" stroke="${color}" ${so} stroke-width="0.9"/></pattern>`;
  if (hatch === "dots") return `<pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="1.6" fill="${color}" ${o}/></pattern>`;
  if (hatch === "cross") return `<pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0,5H10M5,0V10" stroke="${color}" ${so} stroke-width="1.1"/></pattern>`;
  return "";
}

// Hatches used by the core zone and interchanges.
function patternDefs(style: MapStyle) {
  const ink = style.ink;
  return `<defs><pattern id="rm-stripes" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="#fff"/><rect width="7" height="14" fill="${ink}"/></pattern>` +
    hatches.filter(h => h !== "none").map(h => hatchPattern(`rm-zone-${h}`, h, ink, h === "chevrons" ? 0.18 : 0.16)).join("") + `</defs>`;
}

// The ground: plain, a ledger sheet (fine horizontal rules with heavier ones every fifth), or a drafting grid.
function groundSvg(map: ResearchMap, style: MapStyle) {
  const W = map.width; const H = map.height; const out = [`<rect width="${W}" height="${H}" fill="${style.background}"/>`];
  if (style.ground === "ledger") {
    const fine: string[] = []; const bold: string[] = [];
    for (let y = 150, i = 0; y < H - 10; y += 12, i++) (i % 5 === 0 ? bold : fine).push(`M0,${y}H${W}`);
    out.push(`<path d="${fine.join("")}" stroke="${style.rule}" stroke-width="0.6" stroke-opacity="0.8"/>`, `<path d="${bold.join("")}" stroke="${style.rule}" stroke-width="1.2"/>`);
    for (const col of map.columns) for (const x of [col.x0, col.x0 + 6]) out.push(`<line x1="${x}" y1="150" x2="${x}" y2="${H - 10}" stroke="${style.rule}" stroke-width="${x === col.x0 ? 1.4 : 0.7}"/>`);
  } else if (style.ground === "grid") {
    const fine: string[] = []; const bold: string[] = [];
    for (let x = 0, i = 0; x <= W; x += 20, i++) (i % 5 === 0 ? bold : fine).push(`M${x},0V${H}`);
    for (let y = 0, i = 0; y <= H; y += 20, i++) (i % 5 === 0 ? bold : fine).push(`M0,${y}H${W}`);
    out.push(`<path d="${fine.join("")}" stroke="${style.rule}" stroke-width="0.5"/>`, `<path d="${bold.join("")}" stroke="${style.rule}" stroke-width="1"/>`);
  } else if (style.ground === "dots") {
    // A dot grid with fine guide lines every 120, like a plotted site grid.
    const lines: string[] = []; const dots: string[] = [];
    for (let x = 0; x <= W; x += 120) lines.push(`M${x},0V${H}`);
    for (let y = 0; y <= H; y += 120) lines.push(`M0,${y}H${W}`);
    for (let x = 40; x < W; x += 40) for (let y = 40; y < H; y += 40) dots.push(`M${x},${y}h0.01`);
    out.push(`<path d="${lines.join("")}" stroke="${style.rule}" stroke-width="0.8"/>`, `<path d="${dots.join("")}" stroke="${style.rule}" stroke-width="3" stroke-linecap="round"/>`);
  } else if (style.ground === "dashed") {
    // A dashed drafting grid with a measured scale down the left edge.
    const lines: string[] = [];
    for (let x = 0; x <= W; x += 150) lines.push(`M${x},0V${H}`);
    for (let y = 0; y <= H; y += 150) lines.push(`M0,${y}H${W}`);
    out.push(`<path d="${lines.join("")}" stroke="${style.rule}" stroke-width="1" stroke-dasharray="8 6"/>`);
    const ticks: string[] = []; for (let y = 0; y <= H; y += 15) ticks.push(`M14,${y}h${y % 150 === 0 ? 16 : y % 75 === 0 ? 10 : 5}`);
    out.push(`<line x1="14" y1="0" x2="14" y2="${H}" stroke="${style.ink}" stroke-width="1.2"/><path d="${ticks.join("")}" stroke="${style.ink}" stroke-width="0.8"/>`);
    for (let y = 150, n = 1; y < H; y += 150, n++) out.push(textSvg(34, y + 4, String(n), { size: 11, weight: 700, fill: style.ink }));
  }
  return out.join("");
}

// Translucent planes behind each axis, like overlaid sheets of trace. They become ordinary shapes,
// so each can be recolored, reshaped, hidden or deleted.
export function axisPlanes(map: ResearchMap): Shape[] {
  return axisIds(map).flatMap((axis, i) => {
    const pts = map.strands.filter(s => s.axis === axis).flatMap(s => s.points);
    if (!pts.length) return [];
    const x0 = Math.min(...pts.map(p => p[0])) - 30; const x1 = Math.max(...pts.map(p => p[0])) + 30;
    const y0 = Math.min(...pts.map(p => p[1])) - 40; const y1 = Math.max(...pts.map(p => p[1])) + 40;
    const skew = (i - 1) * 60;
    const points: Pt[] = [[x0 + 80 + skew, y0], [x1, y0 + skew / 2], [x1 - 80 - skew, y1], [x0, y1 - skew / 2]];
    return [{ id: `plane-${axis}`, name: `${map.axes[axis].label} plane`, kind: "polygon" as const, points: points.map(p => [Math.round(p[0]), Math.round(p[1])] as Pt), fill: map.axes[axis].color, opacity: 0.09, hatch: "none" as const, stroke: map.axes[axis].color, strokeWidth: 1, outline: "none" as const }];
  });
}
// Shapes as drawn: stored shapes when there are any, otherwise the generated planes if the style asks for them.
export function shapesOf(map: ResearchMap): Shape[] { return map.shapes ?? (styleOf(map).planes ? axisPlanes(map) : []); }
export function shapeBounds(shape: Shape) {
  const xs = shape.points.map(p => p[0]); const ys = shape.points.map(p => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
// A smooth curve through the points (Catmull-Rom), for curved arrows and leaders.
function curvePath(pts: Pt[]) {
  if (pts.length < 3) return `M${pts.map(p => p.join(",")).join(" L")}`;
  let d = `M${pts[0].join(",")}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]; const p1 = pts[i]; const p2 = pts[i + 1]; const p3 = pts[i + 2] || p2;
    d += ` C${r1(p1[0] + (p2[0] - p0[0]) / 6)},${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)},${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${p2.join(",")}`;
  }
  return d;
}
// A line end drawn at p, facing away from q.
function lineEndSvg(kind: LineEnd | undefined, p: Pt, q: Pt, color: string, w: number) {
  if (!kind || kind === "none") return "";
  const a = Math.atan2(p[1] - q[1], p[0] - q[0]); const c = Math.cos(a); const s = Math.sin(a); const k = Math.max(1, w);
  if (kind === "arrow") { const L = 9 + k * 5; const W2 = 4 + k * 2.4; return `<path d="M${r1(p[0] + c * L * 0.25)},${r1(p[1] + s * L * 0.25)} L${r1(p[0] - c * L - s * W2)},${r1(p[1] - s * L + c * W2)} L${r1(p[0] - c * L + s * W2)},${r1(p[1] - s * L - c * W2)} Z" fill="${color}"/>`; }
  if (kind === "circle") return `<circle cx="${p[0]}" cy="${p[1]}" r="${4 + k}" fill="#fff" stroke="${color}" stroke-width="${Math.max(1, w * 0.8)}"/>`;
  if (kind === "dot") return `<circle cx="${p[0]}" cy="${p[1]}" r="${3 + k}" fill="${color}"/>`;
  const L = kind === "bar" ? 10 + k * 3 : 7 + k * 2;
  return `<line x1="${r1(p[0] - s * L)}" y1="${r1(p[1] + c * L)}" x2="${r1(p[0] + s * L)}" y2="${r1(p[1] - c * L)}" stroke="${color}" stroke-width="${kind === "bar" ? Math.max(2, w * 1.6) : Math.max(1, w)}"/>`;
}
export function shapeGeometry(shape: Shape) {
  if (shape.kind === "ellipse") { const b = shapeBounds(shape); return `<ellipse cx="${(b.x0 + b.x1) / 2}" cy="${(b.y0 + b.y1) / 2}" rx="${Math.max(1, (b.x1 - b.x0) / 2)}" ry="${Math.max(1, (b.y1 - b.y0) / 2)}"`; }
  return `<polygon points="${shape.points.map(p => p.join(",")).join(" ")}"`;
}
export function shapeSvg(shape: Shape, ink = INK) {
  if (shape.hidden || shape.points.length < 2) return "";
  const dash = shape.outline === "dashed" ? ` stroke-dasharray="${r1(shape.strokeWidth * 5 + 2)} ${r1(shape.strokeWidth * 4 + 2)}"` : "";
  if (shape.kind === "line") {
    const pts = shape.points; const n = pts.length;
    const d = shape.curve ? curvePath(pts) : `M${pts.map(p => p.join(",")).join(" L")}`;
    const color = shape.stroke; const w = shape.strokeWidth;
    return `<g>${shape.shadow ? `<path d="${d}" transform="translate(6 6)" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="${w}"/>` : ""}<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linejoin="round"${dash}/>` +
      lineEndSvg(shape.start, pts[0], pts[1], color, w) + lineEndSvg(shape.end, pts[n - 1], pts[n - 2], color, w) + `</g>`;
  }
  if (shape.kind === "text") {
    const b = shapeBounds(shape); const size = Math.max(6, b.y1 - b.y0);
    const paint = shape.outlined ? `fill="none" stroke="${shape.stroke}" stroke-width="${Math.max(1, shape.strokeWidth)}"` : `fill="${shape.fill}" fill-opacity="${Math.max(0.05, shape.opacity)}"`;
    const shadow = shape.shadow ? `<text x="${b.x0 + size * 0.05}" y="${b.y1 - size * 0.14 + size * 0.05}" font-size="${size}" font-weight="${shape.weight ?? 800}" fill="#000" fill-opacity="0.3">${esc(shape.text || "")}</text>` : "";
    return `<g>${shadow}<text x="${b.x0}" y="${b.y1 - size * 0.14}" font-size="${size}" font-weight="${shape.weight ?? 800}" ${paint}>${esc(shape.text || "")}</text></g>`;
  }
  const g = shapeGeometry(shape);
  const stroke = shape.outline === "none" ? "" : ` stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}"${dash}`;
  const patternId = `rm-pat-${shape.id}`;
  const pattern = shape.hatch !== "none" ? `<defs>${hatchPattern(patternId, shape.hatch, shape.hatchColor || ink, shape.hatchOpacity ?? (shape.hatch === "chevrons" ? 0.18 : 0.16))}</defs>` : "";
  // A drop shadow: a dark copy offset down and to the right, as in hand-cut collage.
  const shadow = shape.shadow ? `${g} transform="translate(9 9)" fill="#1a1a1a" fill-opacity="0.55"/>` : "";
  return pattern + shadow + `${g} fill="${shape.fill}" fill-opacity="${shape.opacity}"${stroke}/>` + (pattern ? `${g} fill="url(#${patternId})"/>` : "");
}

// Construction layer: hairlines carried past each strand's ends, a measured scale, and registration marks.
function constructionSvg(map: ResearchMap, style: MapStyle) {
  const out: string[] = []; const ink = style.ink; const W = map.width;
  const hair = `stroke="${ink}" stroke-opacity="0.35" stroke-width="0.6"`;
  for (const strand of map.strands) {
    const a = strand.points[0]; const b = strand.points[strand.points.length - 1]; if (!a || !b) continue;
    out.push(`<line x1="20" y1="${a[1]}" x2="${a[0]}" y2="${a[1]}" ${hair}/>`, `<line x1="${b[0]}" y1="${b[1]}" x2="${W - 20}" y2="${b[1]}" ${hair}/>`);
    for (const p of strand.points.slice(1, -1)) out.push(`<circle cx="${p[0]}" cy="${p[1]}" r="14" fill="none" ${hair}/>`);
  }
  for (let x = 300; x < W - 100; x += 300) for (let y = 360; y < MAP_BOTTOM - 40; y += 300) out.push(`<path d="M${x - 4},${y}H${x + 4}M${x},${y - 4}V${y + 4}" stroke="${ink}" stroke-opacity="0.45" stroke-width="0.8"/>`);
  return out.join("");
}

// The section scale: ticks numbered every ten across the top, and registration crosses at each column division, top and bottom.
function scaleSvg(map: ResearchMap, style: MapStyle) {
  const out: string[] = []; const ink = style.ink; const W = map.width;
  const hair = `stroke="${ink}" stroke-opacity="0.35" stroke-width="0.6"`;
  const ticks: string[] = [];
  for (let x = 60; x <= W - 60; x += 25) { const big = (x - 60) % 250 === 0; ticks.push(`M${x},${MAP_TOP - (big ? 14 : 6)}V${MAP_TOP}`); if (big) out.push(textSvg(x + 3, MAP_TOP - 6, String((x - 60) / 25).padStart(2, "0"), { size: 9, fill: ink, weight: 600 })); }
  out.push(`<path d="${ticks.join("")}" stroke="${ink}" stroke-opacity="0.55" stroke-width="0.8"/>`, `<line x1="60" y1="${MAP_TOP}" x2="${W - 60}" y2="${MAP_TOP}" ${hair}/>`);
  const cross = (x: number, y: number, r = 9) => `<path d="M${x - r},${y}H${x + r}M${x},${y - r}V${y + r}" stroke="${ink}" stroke-width="1.2"/><circle cx="${x}" cy="${y}" r="${r * 0.45}" fill="none" stroke="${ink}" stroke-width="0.8"/>`;
  for (const col of map.columns) { out.push(cross(col.x0, MAP_TOP), cross(col.x0, MAP_BOTTOM)); }
  if (map.columns.length) { const last = map.columns[map.columns.length - 1]; out.push(cross(last.x1, MAP_TOP), cross(last.x1, MAP_BOTTOM)); }
  // Column divisions carried down the sheet as fine rules between the crosses.
  for (const col of map.columns.slice(1)) out.push(`<line x1="${col.x0}" y1="${MAP_TOP}" x2="${col.x0}" y2="${MAP_BOTTOM}" ${hair}/>`);
  return out.join("");
}

export function renderMapInner(map: ResearchMap, options: { legend?: boolean } = {}) {
  const style = styleOf(map); const t = metricsOf(map); const ink = style.ink;
  const out: string[] = [];
  const add = (s: string) => out.push(s);
  add(`<g font-family="${esc(fontStacks[style.font])}">`);
  add(patternDefs(style));
  add(groundSvg(map, style));
  const shapes = shapesOf(map);
  for (const shape of shapes) if (!shape.front) add(shapeSvg(shape, ink));
  map.columns.forEach((col, i) => {
    if (i % 2 === 1 && style.bands > 0) add(`<rect x="${col.x0}" y="${MAP_TOP}" width="${col.x1 - col.x0}" height="${MAP_BOTTOM - MAP_TOP}" fill="#000" fill-opacity="${style.bands}"/>`);
    add(roleText(map, "columnTitle", col.x0 + 20, 200, `${String(i + 1).padStart(2, "0")}  ${col.title.toUpperCase()}`, { size: 15, weight: 700, spacing: 2.5 }));
    if (col.subtitle) add(roleText(map, "columnNote", col.x0 + 20, 222, col.subtitle, { size: 13, italic: true }));
    if (i > 0 && style.ground !== "ledger") add(`<line x1="${col.x0}" y1="${MAP_TOP}" x2="${col.x0}" y2="${MAP_BOTTOM}" stroke="${style.rule}" stroke-width="1"/>`);
  });
  if (style.construction) add(constructionSvg(map, style));
  if (style.scale) add(scaleSvg(map, style));
  if (map.columns.length) {
    const x0 = map.columns[0].x0 + 20; const x1 = map.columns[map.columns.length - 1].x1 - 20;
    add(`<line x1="${x0}" y1="245" x2="${x1}" y2="245" stroke="${style.rule}" stroke-width="1"/><path d="M${x1 - 10},240 L${x1},245 L${x1 - 10},250" fill="none" stroke="#b5b5b0" stroke-width="1.2"/>`);
  }
  add(roleText(map, "title", 60, 70, map.title.toUpperCase(), { size: 30, weight: 800, spacing: 1 }));
  const al = rolePaint(map, "axesLine");
  add(`<text x="60" y="104" font-size="${19 * al.scale}" font-weight="${al.bold === false ? 400 : 600}" fill="${al.color}"${al.italic ? ' font-style="italic"' : ""}>${axisIds(map).map(axis => `<tspan fill="${map.axes[axis].color}">${esc(map.axes[axis].label)}</tspan>`).join("  ×  ")}</text>`);
  if (map.subtitle) add(roleText(map, "subtitle", 60, 132, map.subtitle, { size: 14, italic: true }));

  if (map.zone) {
    const z = map.zone;
    const stroke = style.zoneOutline === "none" ? "" : ` stroke="${style.zoneOutline === "dashed" ? ink : "#D9A633"}" stroke-width="1.5"${style.zoneOutline === "dashed" ? ' stroke-dasharray="8 6"' : ""}`;
    add(`<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="${style.corner > 20 ? 22 : 4}" fill="${style.zoneFill}" fill-opacity="${style.zoneOpacity}"${stroke}/>`);
    if (style.zoneHatch !== "none") add(`<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="${style.corner > 20 ? 22 : 4}" fill="url(#rm-zone-${style.zoneHatch})"/>`);
    add(roleText(map, "zoneTitle", z.x + z.w - 18, z.y + 26, z.title.toUpperCase(), { size: 13, weight: 800, fill: style.zoneHatch === "none" ? "#9a6c07" : ink, anchor: "end", spacing: 2.2 }));
  }

  const byId = new Map(map.items.map(item => [item.id, item]));
  const fd = dashAttr(influenceDash(style), style.influenceDash === "dot");
  for (const item of map.items) {
    if (item.feeds) {
      const color = style.influenceInk ? ink : strandColor(map, item.feeds.strand);
      add(`<path d="${roundedPath(feedPath(item, item.feeds, t), 14)}" fill="none" stroke="${color}" stroke-opacity="${style.influenceOpacity}" stroke-width="${style.influenceWidth}"${fd}/>`);
      add(`<circle cx="${item.feeds.at[0]}" cy="${item.feeds.at[1]}" r="${Math.max(2, style.influenceWidth * 2.3)}" fill="${color}"/>`);
    } else if (item.from && byId.get(item.from)) {
      add(`<path d="${roundedPath(branchPath(item, byId.get(item.from)!, t), 0)}" fill="none" stroke="${ink}" stroke-opacity="${Math.min(0.9, style.influenceOpacity + 0.05)}" stroke-width="${style.influenceWidth}"${fd}/>`);
    }
  }
  const sd = dashAttr(strandDash(style));
  if (style.casing) for (const strand of map.strands) add(`<path d="${roundedPath(strand.points, style.corner)}" fill="none" stroke="${style.background}" stroke-width="${style.strandWidth + 5}" stroke-linecap="round" stroke-linejoin="round"/>`);
  for (const strand of map.strands) add(`<path d="${roundedPath(strand.points, style.corner)}" fill="none" stroke="${strandInk(map, strand)}" stroke-width="${style.strandWidth}" stroke-linecap="${sd ? "butt" : "round"}" stroke-linejoin="round"${sd}/>`);
  for (const shape of shapes) if (shape.front) add(shapeSvg(shape, ink));
  for (const item of map.items) if (item.marker && item.marker.type !== "none") add(markerSvg(item.marker.type, item.marker.x, item.marker.y, strandColor(map, item.marker.strand), item.marker.y2, style, item.marker.paint, item.id));
  const kindPaint = Object.fromEntries(kinds.map(k => [k, map.text?.[k] || {}])) as Record<Kind, TextPaint>;
  for (const item of map.items) if (item.name.trim()) add(labelSvg(item, t, ink, kindPaint[item.kind]));
  const pp = map.text?.project || {};
  for (const project of map.projects) add(projectSvg(project, ink, pp));
  if (options.legend !== false) add(legendSvg(map));
  add("</g>");
  return out.join("\n");
}

// The legend lists only what the map uses, and draws it in the map's own style, so it can't drift out of date.
export function legendSvg(map: ResearchMap) {
  const style = styleOf(map); const ink = style.ink; const t = metricsOf(map);
  const out: string[] = []; const add = (s: string) => out.push(s);
  const w = (key: LegendWord) => map.words?.[key] ?? legendWords[key];
  const head = (x: number, y: number, key: LegendWord) => roleText(map, "legendHead", x, y, w(key), { size: 14, weight: 800, spacing: 2 });
  const body = (x: number, y: number, text: string, o: { weight?: number; italic?: boolean } = {}) => roleText(map, "legend", x, y, text, { size: 15, ...o });
  const LY = MAP_BOTTOM + 30;
  add(`<line x1="60" y1="${LY - 14}" x2="${map.width - 60}" y2="${LY - 14}" stroke="${style.rule}"/>`);
  add(head(60, LY + 16, "read"));
  wrap(map.caption, captionChars(t)).slice(0, 7).forEach((line, i) => add(roleText(map, "caption", 60, LY + 44 + i * 21, line, { size: 15 })));

  let lx = 760;
  add(head(lx, LY + 16, "axes"));
  const used = axisIds(map).filter(axis => map.strands.some(s => s.axis === axis)).slice(0, 6);
  const sd = dashAttr(strandDash(style));
  used.forEach((axis, i) => {
    const y = LY + 46 + i * 30;
    add(`<line x1="${lx}" y1="${y}" x2="${lx + 60}" y2="${y}" stroke="${map.axes[axis].color}" stroke-width="${style.strandWidth}" stroke-linecap="${sd ? "butt" : "round"}"${sd}/>`);
    add(body(lx + 75, y + 5, map.axes[axis].label.replace(/ (Systems|Logics?|& AI)$/i, "") || axis, { weight: 600 }));
  });
  if (map.items.some(item => item.feeds)) {
    const y = LY + 46 + used.length * 30;
    add(`<line x1="${lx}" y1="${y}" x2="${lx + 60}" y2="${y}" stroke="${ink}" stroke-opacity="${style.influenceOpacity}" stroke-width="${style.influenceWidth}"${dashAttr(influenceDash(style), style.influenceDash === "dot")}/>`);
    add(body(lx + 75, y + 5, w("influence")));
  }

  lx = 1110;
  add(head(lx, LY + 16, "stations"));
  const usedMarkers = markers.filter(type => type !== "none" && map.items.some(item => item.marker?.type === type));
  usedMarkers.forEach((type, i) => {
    const y = LY + 46 + i * 34;
    add(type === "interchange" ? `<rect x="${lx}" y="${y - 14}" width="24" height="28" rx="12" fill="${interchangePaint(style)}" stroke="${ink}" stroke-width="3"/>` : markerSvg(type, lx + 12, y, ink, undefined, { ...style, stationScale: Math.min(style.stationScale, 1.1) }));
    add(body(lx + 40, y + 5, w(type as LegendWord)));
  });

  lx = 1500;
  add(head(lx, LY + 16, "type"));
  kinds.filter(kind => map.items.some(item => item.kind === kind)).forEach((kind, i) => {
    add(labelSvg({ name: w(kind), kind, main: false, x: lx + (kind === "output" ? 6 : 0), y: LY + 51 + i * 30, anchor: "start" }, { ...t, kinds: undefined }, ink, { ...(map.text?.[kind] || {}), scale: undefined }));
  });

  if (map.projects.length) {
    lx = 1890;
    add(head(lx, LY + 16, "projects"));
    const open = map.projects.filter(p => !p.name.trim()).length;
    const named = map.projects.filter(p => p.name.trim());
    if (named.length) {
      named.slice(0, 5).forEach((p, i) => { add(projectSvg({ x: lx + 17, y: LY + 48 + i * 34, code: p.code, name: p.name, color: p.color }, ink, { color: map.text?.project?.color })); add(body(lx + 45, LY + 53 + i * 34, p.name, { weight: 600 })); });
      if (named.length > 5) add(body(lx + 45, LY + 53 + 5 * 34, `+ ${named.length - 5} more`, { italic: true }));
    }
    if (open) {
      const y = LY + 48 + Math.min(named.length, 5) * 34 + (named.length > 5 ? 34 : 0);
      add(projectSvg({ x: lx + 17, y, code: "P", name: "" }, ink));
      add(body(lx + 45, y + 5, `${w("placeholder")} (${open})`, { weight: 600 }));
    }
  }
  return out.join("\n");
}

// The caption column is a fixed width, so wider lettering fits fewer characters per line.
export const captionChars = (t: Metrics) => Math.floor(88 / t.wide);

export function wrap(text: string, max: number) {
  const lines: string[] = [];
  for (const para of text.split(/\n+/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if ((line + " " + word).trim().length > max) { if (line) lines.push(line); line = word; } else line = (line + " " + word).trim();
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function renderMapSvg(map: ResearchMap) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${map.width}" height="${map.height}" viewBox="0 0 ${map.width} ${map.height}" font-family="${esc(fontStacks[styleOf(map).font])}">\n${renderMapInner(map)}\n</svg>`;
}

// ---------- checks ----------

export interface Issue { level: "fix" | "check"; message: string; item?: string; strand?: string; project?: string }

const knownMisspellings: Record<string, string> = {
  "pier lugi": "Pier Luigi", lugi: "Luigi", scherks: "Scherk", throughtout: "throughout", postion: "position", stereotmy: "stereotomy",
  stereotomoy: "stereotomy", architecure: "architecture", architectual: "architectural", fabricaton: "fabrication", computaional: "computational",
  computaton: "computation", strucutral: "structural", structual: "structural", materail: "material", materal: "material", reasearch: "research", desgin: "design", grasshoper: "Grasshopper", catenery: "catenary", hyperbolc: "hyperbolic", topolgy: "topology",
  emergance: "emergence", deposistion: "deposition", jeting: "jetting", printng: "printing", ornamnet: "ornament", masonary: "masonry", gothik: "gothic",
};
export function misspellings(text: string) {
  const found: { word: string; suggestion: string }[] = [];
  const lower = text.toLowerCase();
  for (const [wrong, right] of Object.entries(knownMisspellings)) {
    if (!right) continue;
    const pattern = new RegExp(`(^|[^a-z])${wrong.replace(/ /g, "\\s+")}([^a-z]|$)`, "i");
    if (pattern.test(lower)) found.push({ word: wrong, suggestion: right });
  }
  return found;
}

export function normalName(name: string) { return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/s\b/g, ""); }
export function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) { const tmp = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = tmp; }
  }
  return row[b.length];
}

const overlaps = (a: Box, b: Box, gap = 0) => a.x0 < b.x1 - gap && b.x0 < a.x1 - gap && a.y0 < b.y1 - gap && b.y0 < a.y1 - gap;
function segmentHitsBox(a: Pt, b: Pt, box: Box) {
  const steps = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4));
  for (let i = 0; i <= steps; i++) { const x = a[0] + (b[0] - a[0]) * i / steps; const y = a[1] + (b[1] - a[1]) * i / steps; if (x > box.x0 + 2 && x < box.x1 - 2 && y > box.y0 + 2 && y < box.y1 - 2) return true; }
  return false;
}

export function checkMap(map: ResearchMap): Issue[] {
  const issues: Issue[] = [];
  const strandIds = new Set(map.strands.map(s => s.id));
  const label = (item: Item) => `“${item.name.replace(/\n/g, " ") || "Untitled"}”`;
  const named = map.items.filter(item => item.name.trim());
  const t = metricsOf(map);

  for (const item of map.items) {
    if (!item.name.trim()) issues.push({ level: "fix", message: "An item has no name.", item: item.id });
    if (!kinds.includes(item.kind)) issues.push({ level: "fix", message: `${label(item)} needs a kind (concept, technique, person or output).`, item: item.id });
    const onStrand = item.marker && item.marker.type !== "none";
    if (!item.feeds && !item.from && !onStrand) issues.push({ level: "fix", message: `${label(item)} isn't connected to anything. Give it a strand to feed, or a station.`, item: item.id });
    if (item.feeds && !strandIds.has(item.feeds.strand)) issues.push({ level: "fix", message: `${label(item)} feeds a strand that no longer exists.`, item: item.id });
    if (item.feeds && strandIds.has(item.feeds.strand)) {
      const strand = map.strands.find(s => s.id === item.feeds!.strand)!;
      if (nearestOnPolyline(strand.points, item.feeds.at).distance > 4) issues.push({ level: "check", message: `${label(item)}'s line stops short of its strand.`, item: item.id });
    }
    if (item.from && !map.items.some(other => other.id === item.from)) issues.push({ level: "fix", message: `${label(item)} branches from an item that was removed.`, item: item.id });
    for (const typo of misspellings(item.name)) issues.push({ level: "fix", message: `${label(item)}: “${typo.word}” is usually spelled “${typo.suggestion}”.`, item: item.id });
    const box = labelBox(item, t);
    if (box.x0 < 0 || box.x1 > map.width || box.y0 < MAP_TOP - 10 || box.y1 > MAP_BOTTOM) issues.push({ level: "check", message: `${label(item)} sits outside the map area.`, item: item.id });
  }

  // Duplicates and near-duplicates.
  for (let i = 0; i < named.length; i++) for (let j = i + 1; j < named.length; j++) {
    const a = normalName(named[i].name); const b = normalName(named[j].name);
    if (a === b) issues.push({ level: "fix", message: `${label(named[i])} appears twice.`, item: named[j].id });
    else if (Math.min(a.length, b.length) >= 6 && editDistance(a, b) <= 2) issues.push({ level: "check", message: `${label(named[i])} and ${label(named[j])} look like the same thing spelled two ways.`, item: named[j].id });
  }

  // Strands read left to right at transit angles and end at an outcome.
  for (const strand of map.strands) {
    const pts = strand.points;
    const start = map.items.find(item => item.marker?.type === "start" && item.marker.strand === strand.id);
    const name = start ? label(start) : `A ${strand.axis} strand`;
    if (pts.length < 2) { issues.push({ level: "fix", message: `${name} has fewer than two points.`, strand: strand.id }); continue; }
    if (pts.some((p, i) => i > 0 && p[0] < pts[i - 1][0] - 0.5)) issues.push({ level: "check", message: `${name} turns back right to left. The map reads left to right.`, strand: strand.id });
    if (pts.some((p, i) => i > 0 && !segmentAngleOk(pts[i - 1], p))) issues.push({ level: "check", message: `${name} has a bend that isn't at 0°, 45° or 90°.`, strand: strand.id });
    const end = pts[pts.length - 1];
    const ends = map.items.some(item => item.marker && (item.marker.type === "outcome" || item.marker.type === "interchange") && Math.abs(item.marker.x - end[0]) < 25 && end[1] >= Math.min(item.marker.y, item.marker.y2 ?? item.marker.y) - 25 && end[1] <= Math.max(item.marker.y, item.marker.y2 ?? item.marker.y) + 25);
    if (!ends) issues.push({ level: "check", message: `${name} doesn't end at an outcome station.`, strand: strand.id });
    if (!start) issues.push({ level: "check", message: `A ${strand.axis} strand has no starting station, so it has no name.`, strand: strand.id });
  }

  // Labels must not collide with each other or run under a strand.
  const boxes = named.map(item => ({ item, box: labelBox(item, t) }));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    if (overlaps(boxes[i].box, boxes[j].box, 1)) issues.push({ level: "check", message: `${label(boxes[i].item)} and ${label(boxes[j].item)} overlap.`, item: boxes[j].item.id });
  }
  for (const { item, box } of boxes) {
    const hit = map.strands.find(strand => strand.points.some((p, i) => i > 0 && segmentHitsBox(strand.points[i - 1], p, box)));
    if (hit) issues.push({ level: "check", message: `A strand runs through the label ${label(item)}.`, item: item.id });
  }

  // Projects.
  for (const project of map.projects) if (!project.name.trim()) issues.push({ level: "check", message: `${project.code} is still a placeholder. Name the project that sits here.`, project: project.id });
  if (map.zone) {
    const z = map.zone;
    const inside = map.projects.filter(p => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h);
    if (!inside.length) issues.push({ level: "check", message: "No project sits in the core contribution zone." });
    else if (!inside.some(p => p.name.trim())) issues.push({ level: "check", message: "The core contribution zone has only placeholder projects." });
  }
  const codes = map.projects.map(p => p.code.trim().toLowerCase());
  if (new Set(codes).size !== codes.length) issues.push({ level: "fix", message: "Two project stations share a code." });

  // Caption.
  if (!map.caption.trim()) issues.push({ level: "fix", message: "The “how to read this” caption is empty." });
  for (const typo of misspellings(`${map.caption} ${map.title} ${map.subtitle}`)) issues.push({ level: "fix", message: `Caption or title: “${typo.word}” is usually spelled “${typo.suggestion}”.` });
  if (wrap(map.caption, captionChars(t)).length > 7) issues.push({ level: "check", message: "The caption is longer than the seven lines the legend has room for." });
  return issues;
}

// ---------- parsing, ids, diffs ----------

const num = (v: unknown, fallback = 0) => typeof v === "number" && Number.isFinite(v) ? Math.max(-10000, Math.min(20000, v)) : fallback;
const str = (v: unknown, max = 300) => typeof v === "string" ? v.slice(0, max) : "";
const pt = (v: unknown): Pt | null => Array.isArray(v) && v.length === 2 ? [num(v[0]), num(v[1])] : null;
const id = (v: unknown) => typeof v === "string" && /^[a-z0-9_-]{1,40}$/i.test(v) ? v : null;
const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T) => list.includes(v as T) ? v as T : fallback;

const hex = (c: unknown, fallback: string) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback;
const clamp = (v: unknown, lo: number, hi: number, fallback: number) => typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

function parseTextPaint(value: unknown): TextPaint | undefined {
  if (!value || typeof value !== "object") return undefined;
  const r = value as Record<string, unknown>; const paint: TextPaint = {};
  if (hex(r.color, "")) paint.color = hex(r.color, "");
  if (typeof r.scale === "number") paint.scale = clamp(r.scale, 0.4, 4, 1);
  if (typeof r.bold === "boolean") paint.bold = r.bold;
  if (typeof r.italic === "boolean") paint.italic = r.italic;
  return Object.keys(paint).length ? paint : undefined;
}
function parsePaint(value: unknown): MarkerPaint | undefined {
  if (!value || typeof value !== "object") return undefined;
  const r = value as Record<string, unknown>; const paint: MarkerPaint = {};
  if (r.fill === "white" || r.fill === "stripes" || r.fill === "none") paint.fill = r.fill; else if (hex(r.fill, "")) paint.fill = hex(r.fill, "");
  if (hex(r.stroke, "")) paint.stroke = hex(r.stroke, "");
  if (typeof r.scale === "number") paint.scale = clamp(r.scale, 0.3, 4, 1);
  if (typeof r.weight === "number") paint.weight = clamp(r.weight, 0.2, 4, 1);
  return Object.keys(paint).length ? paint : undefined;
}
function parseShapes(value: unknown): Shape[] {
  return (Array.isArray(value) ? value : []).slice(0, 80).flatMap(v => {
    const r = (v || {}) as Record<string, unknown>; const sid = id(r.id); if (!sid) return [];
    const points = Array.isArray(r.points) ? r.points.slice(0, 60).map(pt).filter((p): p is Pt => !!p) : [];
    if (points.length < 2) return [];
    return [{ id: sid, name: str(r.name, 60), kind: pick(shapeKinds, r.kind, "polygon"), points, fill: hex(r.fill, "#F2A890"), opacity: clamp(r.opacity, 0, 1, 0.3), hatch: pick(hatches, r.hatch, "none"),
      stroke: hex(r.stroke, "#141414"), strokeWidth: clamp(r.strokeWidth, 0.2, 12, 1), outline: pick(outlines, r.outline, "none"), ...(r.front === true ? { front: true } : {}), ...(r.hidden === true ? { hidden: true } : {}),
      ...(hex(r.hatchColor, "") ? { hatchColor: hex(r.hatchColor, "") } : {}), ...(typeof r.hatchOpacity === "number" ? { hatchOpacity: clamp(r.hatchOpacity, 0, 1, 0.16) } : {}), ...(r.shadow === true ? { shadow: true } : {}),
      ...(lineEnds.includes(r.start as LineEnd) && r.start !== "none" ? { start: r.start as LineEnd } : {}), ...(lineEnds.includes(r.end as LineEnd) && r.end !== "none" ? { end: r.end as LineEnd } : {}), ...(r.curve === true ? { curve: true } : {}),
      ...(typeof r.text === "string" ? { text: str(r.text, 80) } : {}), ...(r.outlined === true ? { outlined: true } : {}), ...(typeof r.weight === "number" ? { weight: Math.round(clamp(r.weight, 100, 900, 800) / 100) * 100 } : {}) }];
  });
}

// Any missing or out-of-range setting falls back to the default look.
export function parseStyle(value: unknown): MapStyle {
  const r = (value && typeof value === "object" ? value : {}) as Record<string, unknown>; const d = defaultStyle;
  return {
    ground: pick(grounds, r.ground, d.ground), background: hex(r.background, d.background), rule: hex(r.rule, d.rule), bands: clamp(r.bands, 0, 0.2, d.bands),
    strandWidth: clamp(r.strandWidth, 1, 16, d.strandWidth), corner: clamp(r.corner, 0, 80, d.corner), strandDash: pick(strandDashes, r.strandDash, d.strandDash), casing: typeof r.casing === "boolean" ? r.casing : d.casing,
    influenceWidth: clamp(r.influenceWidth, 0.3, 6, d.influenceWidth), influenceDash: pick(influenceDashes, r.influenceDash, d.influenceDash), influenceOpacity: clamp(r.influenceOpacity, 0.1, 1, d.influenceOpacity), influenceInk: r.influenceInk === true,
    stationScale: clamp(r.stationScale, 0.4, 2.5, d.stationScale), stationStroke: clamp(r.stationStroke, 0.3, 3, d.stationStroke), interchangeFill: pick(fills, r.interchangeFill, d.interchangeFill),
    font: pick(fonts, r.font, d.font), textScale: clamp(r.textScale, 0.6, 1.6, d.textScale), ink: hex(r.ink, d.ink),
    zoneFill: hex(r.zoneFill, d.zoneFill), zoneOpacity: clamp(r.zoneOpacity, 0, 1, d.zoneOpacity), zoneHatch: pick(hatches, r.zoneHatch, d.zoneHatch), zoneOutline: pick(outlines, r.zoneOutline, d.zoneOutline),
    construction: r.construction === true, planes: r.planes === true,
    // Older maps had the scale as part of the construction lines.
    scale: typeof r.scale === "boolean" ? r.scale : r.construction === true,
  };
}

// Accepts only the shape above, so a bad save can't break the page.
export function parseMap(value: unknown): ResearchMap | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.strands) || !Array.isArray(v.items)) return null;
  const rawAxes = (v.axes && typeof v.axes === "object" ? v.axes : {}) as Record<string, { label?: unknown; color?: unknown }>;
  const color = (c: unknown, fallback: string) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback;
  const defaults = { material: { label: "Material Systems", color: "#C4572B" }, structure: { label: "Structural Logics", color: "#2459A8" }, computation: { label: "Computation & AI", color: "#8E3B8F" } };
  // Categories: the stored ones in order, or the three defaults for an older map.
  const axisEntries = Object.entries(rawAxes).filter(([key, a]) => id(key) && a && typeof a === "object").slice(0, 12);
  const mapAxes: Record<string, { label: string; color: string }> = axisEntries.length
    ? Object.fromEntries(axisEntries.map(([key, a]) => [key, { label: str(a.label, 40) || (defaults as Record<string, { label: string }>)[key]?.label || "Category", color: color(a.color, (defaults as Record<string, { color: string }>)[key]?.color || "#555555") }]))
    : defaults;
  const axisKeys = Object.keys(mapAxes);
  const strands = (v.strands as unknown[]).slice(0, 60).flatMap(s => {
    const r = s as Record<string, unknown>; const sid = id(r.id);
    const points = Array.isArray(r.points) ? r.points.slice(0, 40).map(pt).filter((p): p is Pt => !!p) : [];
    const own = hex(r.color, "");
    return sid ? [{ id: sid, axis: typeof r.axis === "string" && axisKeys.includes(r.axis) ? r.axis : axisKeys[0], points, ...(own ? { color: own } : {}) }] : [];
  });
  const items = (v.items as unknown[]).slice(0, 400).flatMap(s => {
    const r = s as Record<string, unknown>; const iid = id(r.id); if (!iid) return [];
    const item: Item = { id: iid, name: str(r.name, 120), kind: pick(kinds, r.kind, "concept"), main: r.main === true, x: num(r.x), y: num(r.y), anchor: pick(["start", "middle", "end"] as const, r.anchor, "start") };
    const m = r.marker as Record<string, unknown> | undefined;
    if (m && typeof m === "object") {
      item.marker = { type: pick(markers, m.type, "none"), x: num(m.x), y: num(m.y), ...(typeof m.y2 === "number" ? { y2: num(m.y2) } : {}), ...(id(m.strand) ? { strand: id(m.strand)! } : {}) };
      const paint = parsePaint(m.paint); if (paint) item.marker.paint = paint;
    }
    const f = r.feeds as Record<string, unknown> | undefined;
    if (f && typeof f === "object" && id(f.strand) && pt(f.at)) item.feeds = { strand: id(f.strand)!, at: pt(f.at)!, route: pick(routes, f.route, "under") };
    if (id(r.from)) item.from = id(r.from)!;
    const paint = parseTextPaint(r.paint); if (paint) item.paint = paint;
    return [item];
  });
  const projects = (Array.isArray(v.projects) ? v.projects : []).slice(0, 60).flatMap(s => {
    const r = s as Record<string, unknown>; const pid = id(r.id); if (!pid) return [];
    const projectId = typeof r.projectId === "string" && /^[0-9a-f-]{36}$/i.test(r.projectId) ? r.projectId : undefined;
    return [{ id: pid, code: str(r.code, 6) || "P", name: str(r.name, 120), x: num(r.x), y: num(r.y), ...(projectId ? { projectId } : {}), ...(str(r.note, 500) ? { note: str(r.note, 500) } : {}), ...(hex(r.color, "") ? { color: hex(r.color, "") } : {}) }];
  });
  const columns = (Array.isArray(v.columns) ? v.columns : []).slice(0, 6).map(c => { const r = c as Record<string, unknown>; return { title: str(r.title, 40), subtitle: str(r.subtitle, 80), x0: num(r.x0), x1: num(r.x1) }; });
  const z = v.zone as Record<string, unknown> | null | undefined;
  return {
    version: 1, width: num(v.width, 2400) || 2400, height: num(v.height, 1500) || 1500,
    title: str(v.title, 80) || "Research Framework", subtitle: str(v.subtitle, 200),
    axes: mapAxes,
    columns, zone: z && typeof z === "object" ? { x: num(z.x), y: num(z.y), w: Math.max(40, num(z.w, 200)), h: Math.max(40, num(z.h, 120)), title: str(z.title, 40) } : null,
    strands, items, projects, caption: str(v.caption, 1200),
    ...(v.style && typeof v.style === "object" ? { style: parseStyle(v.style) } : {}),
    ...(Array.isArray(v.shapes) ? { shapes: parseShapes(v.shapes) } : {}),
    ...(() => { const r = (v.text && typeof v.text === "object" ? v.text : {}) as Record<string, unknown>; const text = Object.fromEntries(textRoles.flatMap(role => { const p = parseTextPaint(r[role]); return p ? [[role, p]] : []; })); return Object.keys(text).length ? { text } : {}; })(),
    ...(() => { const r = (v.words && typeof v.words === "object" ? v.words : {}) as Record<string, unknown>; const words = Object.fromEntries((Object.keys(legendWords) as LegendWord[]).flatMap(k => typeof r[k] === "string" ? [[k, str(r[k], 80)]] : [])); return Object.keys(words).length ? { words } : {}; })(),
    ...(Array.isArray(v.stylePresets) ? { stylePresets: v.stylePresets.slice(0, 20).flatMap(p => { const r = p as Record<string, unknown>; const n = str(r?.name, 40); return n ? [{ name: n, style: parseStyle(r.style) }] : []; }) } : {}),
  };
}

export function newId(prefix: string, taken: Iterable<string>) {
  const used = new Set(taken); let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

// What changed between two versions, in words, for the change log and snapshot comparison.
export function diffMaps(before: ResearchMap, after: ResearchMap) {
  const changes: string[] = [];
  const name = (item: Item) => `“${item.name.replace(/\n/g, " ")}”`;
  const old = new Map(before.items.map(item => [item.id, item]));
  const now = new Map(after.items.map(item => [item.id, item]));
  for (const item of after.items) {
    const prev = old.get(item.id);
    if (!prev) { changes.push(`Added ${name(item)}`); continue; }
    if (prev.name !== item.name) changes.push(`Renamed ${name(prev)} to ${name(item)}`);
    if (prev.kind !== item.kind) changes.push(`${name(item)} is now a ${kindLabels[item.kind].toLowerCase()}`);
    if (prev.feeds?.strand !== item.feeds?.strand && item.feeds) changes.push(`${name(item)} now feeds a different strand`);
    if ((prev.marker?.type || "none") !== (item.marker?.type || "none")) changes.push(`${name(item)} station: ${markerLabels[item.marker?.type || "none"].toLowerCase()}`);
  }
  for (const item of before.items) if (!now.has(item.id)) changes.push(`Removed ${name(item)}`);
  const oldStrands = new Map(before.strands.map(s => [s.id, s]));
  for (const strand of after.strands) {
    const prev = oldStrands.get(strand.id);
    if (!prev) changes.push(`Added a ${strand.axis} strand`);
    else if (prev.axis !== strand.axis) changes.push(`A strand moved from ${prev.axis} to ${strand.axis}`);
    else if (JSON.stringify(prev.points) !== JSON.stringify(strand.points)) changes.push("Re-routed a strand");
    if (prev && (prev.color || "") !== (strand.color || "")) changes.push("Recolored a strand");
  }
  for (const strand of before.strands) if (!after.strands.some(s => s.id === strand.id)) changes.push(`Removed a ${strand.axis} strand`);
  const oldProjects = new Map(before.projects.map(p => [p.id, p]));
  for (const project of after.projects) {
    const prev = oldProjects.get(project.id);
    if (!prev) changes.push(`Added project station ${project.code}`);
    else if (prev.name !== project.name) changes.push(project.name ? `${project.code} is now “${project.name}”` : `${project.code} is a placeholder again`);
  }
  for (const project of before.projects) if (!after.projects.some(p => p.id === project.id)) changes.push(`Removed project station ${project.code}`);
  if (before.caption !== after.caption) changes.push("Edited the caption");
  if (before.title !== after.title || before.subtitle !== after.subtitle) changes.push("Edited the title");
  for (const key of axisIds(after)) if (!before.axes[key]) changes.push(`Added the category “${after.axes[key].label}”`);
  for (const key of axisIds(before)) if (!after.axes[key]) changes.push(`Removed the category “${before.axes[key].label}”`);
  if (axisIds(after).some(key => before.axes[key] && JSON.stringify(before.axes[key]) !== JSON.stringify(after.axes[key]))) changes.push("Changed the categories");
  if (JSON.stringify(before.text || {}) !== JSON.stringify(after.text || {})) changes.push("Changed the text colors or sizes");
  if (JSON.stringify(before.words || {}) !== JSON.stringify(after.words || {})) changes.push("Edited the legend wording");
  const recolored = after.items.filter(item => { const prev = old.get(item.id); return prev && JSON.stringify(prev.paint || null) !== JSON.stringify(item.paint || null); }).length;
  if (recolored) changes.push(`Restyled ${recolored} label${recolored === 1 ? "" : "s"}`);
  if (JSON.stringify(before.zone) !== JSON.stringify(after.zone)) changes.push("Moved the core zone");
  if (JSON.stringify(styleOf(before)) !== JSON.stringify(styleOf(after))) changes.push("Changed the style");
  const oldShapes = new Map(shapesOf(before).map(sh => [sh.id, sh])); const newShapes = shapesOf(after);
  for (const shape of newShapes) { const prev = oldShapes.get(shape.id); if (!prev) changes.push(`Added the shape “${shape.name || "Untitled"}”`); else if (JSON.stringify(prev) !== JSON.stringify(shape)) changes.push(`Edited the shape “${shape.name || "Untitled"}”`); }
  for (const shape of oldShapes.values()) if (!newShapes.some(sh => sh.id === shape.id)) changes.push(`Removed the shape “${shape.name || "Untitled"}”`);
  const restyled = after.items.filter(item => { const prev = old.get(item.id); return prev && JSON.stringify(prev.marker?.paint || null) !== JSON.stringify(item.marker?.paint || null); });
  for (const item of restyled) changes.push(`Restyled the station ${name(item)}`);
  if (JSON.stringify(before.stylePresets || []) !== JSON.stringify(after.stylePresets || [])) changes.push("Updated the saved styles");
  const moved = after.items.filter(item => { const prev = old.get(item.id); return prev && (prev.x !== item.x || prev.y !== item.y); }).length;
  if (moved) changes.push(`Moved ${moved} label${moved === 1 ? "" : "s"}`);
  return changes;
}

export interface LogEntry { at: string; changes: string[] }
export function appendLog(log: LogEntry[], changes: string[], at: string) {
  if (!changes.length) return log;
  return [{ at, changes: changes.slice(0, 40) }, ...log].slice(0, 300);
}
export function parseLog(value: unknown): LogEntry[] {
  return Array.isArray(value) ? value.slice(0, 300).flatMap(entry => {
    const e = entry as { at?: unknown; changes?: unknown };
    return typeof e?.at === "string" && Array.isArray(e.changes) ? [{ at: e.at, changes: e.changes.filter((c): c is string => typeof c === "string").slice(0, 40) }] : [];
  }) : [];
}
