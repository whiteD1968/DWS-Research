// The research map is a transit-style diagram of Dustin's research: strands (thick lines) coloured by axis,
// stations on them, and the people, ideas and techniques that feed each strand.
// Content and layout are stored together as plain data; the drawing is always generated from it,
// so the map keeps one visual language however often it is edited.

export const researchMapParent = "research_map";
export const researchMapSnapshotParent = "research_map_snapshot";

export const axes = ["material", "structure", "computation"] as const;
export type Axis = (typeof axes)[number];
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
export interface Strand { id: string; axis: Axis; points: Pt[] }
export interface Marker { type: MarkerType; x: number; y: number; y2?: number; strand?: string }
export interface Feed { strand: string; at: Pt; route: Route }
export interface Item {
  id: string; name: string; kind: Kind; main: boolean;
  x: number; y: number; anchor: "start" | "middle" | "end";
  marker?: Marker; feeds?: Feed; from?: string;
}
export interface Project { id: string; code: string; name: string; projectId?: string; x: number; y: number; note?: string }
export interface Column { title: string; subtitle: string; x0: number; x1: number }
export interface ResearchMap {
  version: 1; width: number; height: number;
  title: string; subtitle: string;
  axes: Record<Axis, { label: string; color: string }>;
  columns: Column[];
  zone: { x: number; y: number; w: number; h: number; title: string } | null;
  strands: Strand[]; items: Item[]; projects: Project[];
  caption: string;
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

export function labelSize(item: Pick<Item, "main" | "kind">) {
  const size = item.main ? 21 : 14;
  return item.kind === "technique" ? size - (item.main ? 2 : 2.5) : item.kind === "person" ? size - 1 : size;
}
export function labelLines(name: string) { return name.split("\n").map(line => line.trim()).filter(Boolean); }

// Estimated text width; the drawing is generated without a browser, so this stays deliberately generous.
export function labelWidth(item: Pick<Item, "name" | "main" | "kind">) {
  const size = labelSize(item);
  const per = item.kind === "technique" ? (item.main ? 0.74 : 0.7) : item.kind === "person" ? 0.5 : item.main ? 0.56 : 0.53;
  return Math.max(...labelLines(item.name || " ").map(line => line.length), 1) * size * per;
}

export interface Box { x0: number; y0: number; x1: number; y1: number }
export function labelBox(item: Item): Box {
  const width = labelWidth(item); const size = labelSize(item); const lines = Math.max(labelLines(item.name).length, 1);
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

export function feedPath(item: Item, feed: Feed): Pt[] {
  const width = labelWidth(item); const sy = item.y + 7;
  const sx = item.anchor === "start" ? item.x : item.anchor === "end" ? item.x - width : item.x - width / 2;
  const [tx, ty] = feed.at;
  if (feed.route === "end") return [[sx, sy], [sx + width, sy], [tx, ty]];
  if (feed.route === "start") return [[sx + width, sy], [sx, sy], [tx, ty]];
  const dy = Math.abs(ty - sy);
  if (feed.route === "level") { const bx = Math.max(sx + width, tx - dy); return [[sx, sy], [sx + width, sy], [bx, sy], [tx, ty]]; }
  const bx = Math.max(tx - dy, sx + width);
  return [[sx, sy], [bx, sy], [tx, ty]];
}

export function branchPath(item: Item, parent: Item): Pt[] {
  const box = labelBox(parent); const px = Math.min(box.x1 - 30, Math.max(box.x0 + 30, item.x));
  return [[item.x - 7, item.y - 6], [item.x - 22, item.y - 6], [item.x - 22, box.y1 + 12], [px, box.y1 + 12], [px, box.y1]];
}

// ---------- drawing ----------

function textSvg(x: number, y: number, s: string, o: { size: number; weight?: number; fill?: string; anchor?: string; italic?: boolean; spacing?: number; caps?: boolean }) {
  const lines = labelLines(s); const step = o.size * 1.2;
  const body = lines.map((line, i) => `<tspan x="${x}" dy="${i ? step : 0}">${esc(o.caps ? line.toUpperCase() : line)}</tspan>`).join("");
  return `<text x="${x}" y="${y}" font-size="${o.size}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? INK}" text-anchor="${o.anchor ?? "start"}"${o.italic ? ' font-style="italic"' : ""}${o.spacing ? ` letter-spacing="${o.spacing}"` : ""}>${body}</text>`;
}

export function labelSvg(item: Pick<Item, "name" | "kind" | "main" | "x" | "y" | "anchor">) {
  const size = labelSize(item); const weight = item.main ? 700 : 400; const fill = item.main ? INK : "#3a3a3a";
  if (item.kind === "technique") return textSvg(item.x, item.y, item.name, { size, weight, fill, anchor: item.anchor, spacing: item.main ? 1.6 : 1.2, caps: true });
  if (item.kind === "person") return textSvg(item.x, item.y, item.name, { size, weight, fill: MUTED, anchor: item.anchor, italic: true });
  if (item.kind === "output") {
    const box = labelBox(item as Item);
    return `<rect x="${r1(box.x0)}" y="${r1(box.y0)}" width="${r1(box.x1 - box.x0)}" height="${r1(box.y1 - box.y0)}" fill="#fff" fill-opacity="0.55" stroke="${INK}" stroke-width="${item.main ? 1.6 : 1}"/>` + textSvg(item.x, item.y, item.name, { size, weight, fill, anchor: item.anchor });
  }
  return textSvg(item.x, item.y, item.name, { size, weight, fill, anchor: item.anchor });
}

export function strandColor(map: ResearchMap, strandId?: string) {
  const strand = map.strands.find(s => s.id === strandId);
  return strand ? map.axes[strand.axis].color : INK;
}

export function markerSvg(type: MarkerType, x: number, y: number, color: string, y2?: number) {
  const span = y2 !== undefined && Math.abs(y2 - y) > 1;
  const top = span ? Math.min(y, y2!) : y; const bottom = span ? Math.max(y, y2!) : y;
  if (type === "start") return `<circle cx="${x}" cy="${y}" r="9" fill="${color}"/><circle cx="${x}" cy="${y}" r="4" fill="#fff"/>`;
  if (type === "stop") return `<circle cx="${x}" cy="${y}" r="8" fill="#fff" stroke="${color}" stroke-width="3"/>`;
  if (type === "interchange") return `<rect x="${x - 15}" y="${top - 15}" width="30" height="${bottom - top + 30}" rx="15" fill="#fff" stroke="${INK}" stroke-width="3.5"/>`;
  if (type === "outcome") return span
    ? `<rect x="${x - 15}" y="${top - 13}" width="30" height="${bottom - top + 26}" rx="15" fill="#fff" stroke="${color}" stroke-width="5"/>`
    : `<circle cx="${x}" cy="${y}" r="10" fill="#fff" stroke="${color}" stroke-width="5"/>`;
  return "";
}

export function projectSvg(project: Pick<Project, "x" | "y" | "code" | "name">) {
  const named = !!project.name.trim();
  return `<g><circle cx="${project.x}" cy="${project.y}" r="17" fill="${named ? "#F6D78B" : "#fff"}" stroke="${INK}" stroke-width="2"${named ? "" : ' stroke-dasharray="4 3"'}/>` +
    `<text x="${project.x}" y="${project.y + 5}" font-size="14" font-weight="800" fill="${INK}" text-anchor="middle">${esc(project.code)}</text></g>`;
}

export function renderMapInner(map: ResearchMap, options: { legend?: boolean } = {}) {
  const out: string[] = [];
  const add = (s: string) => out.push(s);
  const { width: W } = map;
  add(`<rect width="${W}" height="${map.height}" fill="${BG}"/>`);
  map.columns.forEach((col, i) => {
    if (i % 2 === 1) add(`<rect x="${col.x0}" y="${MAP_TOP}" width="${col.x1 - col.x0}" height="${MAP_BOTTOM - MAP_TOP}" fill="#000" fill-opacity="0.025"/>`);
    add(textSvg(col.x0 + 20, 200, `${String(i + 1).padStart(2, "0")}  ${col.title.toUpperCase()}`, { size: 15, weight: 700, fill: "#9a9a96", spacing: 2.5 }));
    if (col.subtitle) add(textSvg(col.x0 + 20, 222, col.subtitle, { size: 13, fill: "#9a9a96", italic: true }));
    if (i > 0) add(`<line x1="${col.x0}" y1="${MAP_TOP}" x2="${col.x0}" y2="${MAP_BOTTOM}" stroke="#c9c9c5" stroke-width="1"/>`);
  });
  if (map.columns.length) {
    const x0 = map.columns[0].x0 + 20; const x1 = map.columns[map.columns.length - 1].x1 - 20;
    add(`<line x1="${x0}" y1="245" x2="${x1}" y2="245" stroke="#c9c9c5" stroke-width="1"/><path d="M${x1 - 10},240 L${x1},245 L${x1 - 10},250" fill="none" stroke="#b5b5b0" stroke-width="1.2"/>`);
  }
  add(textSvg(60, 70, map.title.toUpperCase(), { size: 30, weight: 800, spacing: 1 }));
  add(`<text x="60" y="104" font-size="19" font-weight="600" fill="${INK}">${axes.map(axis => `<tspan fill="${map.axes[axis].color}">${esc(map.axes[axis].label)}</tspan>`).join("  ×  ")}</text>`);
  if (map.subtitle) add(textSvg(60, 132, map.subtitle, { size: 14, fill: MUTED, italic: true }));

  if (map.zone) {
    const z = map.zone;
    add(`<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="22" fill="#F6D78B" fill-opacity="0.45" stroke="#D9A633" stroke-width="1.5"/>`);
    add(textSvg(z.x + z.w - 18, z.y + 26, z.title.toUpperCase(), { size: 13, weight: 800, fill: "#9a6c07", anchor: "end", spacing: 2.2 }));
  }

  const byId = new Map(map.items.map(item => [item.id, item]));
  for (const item of map.items) {
    if (item.feeds) {
      const color = strandColor(map, item.feeds.strand);
      add(`<path d="${roundedPath(feedPath(item, item.feeds), 14)}" fill="none" stroke="${color}" stroke-opacity="0.55" stroke-width="1.4" stroke-dasharray="7 5"/>`);
      add(`<circle cx="${item.feeds.at[0]}" cy="${item.feeds.at[1]}" r="3.2" fill="${color}"/>`);
    } else if (item.from && byId.get(item.from)) {
      add(`<path d="${roundedPath(branchPath(item, byId.get(item.from)!), 0)}" fill="none" stroke="${INK}" stroke-opacity="0.5" stroke-width="1.4" stroke-dasharray="7 5"/>`);
    }
  }
  for (const strand of map.strands) add(`<path d="${roundedPath(strand.points, 30)}" fill="none" stroke="${BG}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`);
  for (const strand of map.strands) add(`<path d="${roundedPath(strand.points, 30)}" fill="none" stroke="${map.axes[strand.axis].color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`);
  for (const item of map.items) if (item.marker && item.marker.type !== "none") add(markerSvg(item.marker.type, item.marker.x, item.marker.y, strandColor(map, item.marker.strand), item.marker.y2));
  for (const item of map.items) if (item.name.trim()) add(labelSvg(item));
  for (const project of map.projects) add(projectSvg(project));
  if (options.legend !== false) add(legendSvg(map));
  return out.join("\n");
}

// The legend lists only what the map uses, so it can't drift out of date.
export function legendSvg(map: ResearchMap) {
  const out: string[] = []; const add = (s: string) => out.push(s);
  const LY = MAP_BOTTOM + 30;
  add(`<line x1="60" y1="${LY - 14}" x2="${map.width - 60}" y2="${LY - 14}" stroke="#c9c9c5"/>`);
  add(textSvg(60, LY + 16, "HOW TO READ THIS", { size: 14, weight: 800, spacing: 2 }));
  wrap(map.caption, 88).slice(0, 7).forEach((line, i) => add(textSvg(60, LY + 44 + i * 21, line, { size: 15, fill: "#333" })));

  let lx = 760;
  add(textSvg(lx, LY + 16, "AXES", { size: 14, weight: 800, spacing: 2 }));
  const used = axes.filter(axis => map.strands.some(s => s.axis === axis));
  used.forEach((axis, i) => {
    const y = LY + 46 + i * 30;
    add(`<line x1="${lx}" y1="${y}" x2="${lx + 60}" y2="${y}" stroke="${map.axes[axis].color}" stroke-width="6" stroke-linecap="round"/>`);
    add(textSvg(lx + 75, y + 5, map.axes[axis].label.replace(/ (Systems|Logics?|& AI)$/i, "") || axis, { size: 15, weight: 600 }));
  });
  if (map.items.some(item => item.feeds)) {
    const y = LY + 46 + used.length * 30;
    add(`<line x1="${lx}" y1="${y}" x2="${lx + 60}" y2="${y}" stroke="${INK}" stroke-opacity="0.45" stroke-width="1.4" stroke-dasharray="7 5"/>`);
    add(textSvg(lx + 75, y + 5, "Influence feeding a strand", { size: 15 }));
  }

  lx = 1110;
  add(textSvg(lx, LY + 16, "STATIONS", { size: 14, weight: 800, spacing: 2 }));
  const usedMarkers = markers.filter(type => type !== "none" && map.items.some(item => item.marker?.type === type));
  usedMarkers.forEach((type, i) => {
    const y = LY + 46 + i * 34;
    add(type === "interchange" ? `<rect x="${lx}" y="${y - 14}" width="24" height="28" rx="12" fill="#fff" stroke="${INK}" stroke-width="3"/>` : markerSvg(type, lx + 12, y, INK));
    add(textSvg(lx + 40, y + 5, markerLabels[type], { size: 15 }));
  });

  lx = 1500;
  add(textSvg(lx, LY + 16, "TYPE", { size: 14, weight: 800, spacing: 2 }));
  kinds.filter(kind => map.items.some(item => item.kind === kind)).forEach((kind, i) => {
    add(labelSvg({ name: kindLabels[kind], kind, main: false, x: lx + (kind === "output" ? 6 : 0), y: LY + 51 + i * 30, anchor: "start" }));
  });

  if (map.projects.length) {
    lx = 1890;
    add(textSvg(lx, LY + 16, "MY PROJECTS", { size: 14, weight: 800, spacing: 2 }));
    const open = map.projects.filter(p => !p.name.trim()).length;
    const named = map.projects.filter(p => p.name.trim());
    if (named.length) {
      named.slice(0, 5).forEach((p, i) => { add(projectSvg({ x: lx + 17, y: LY + 48 + i * 34, code: p.code, name: p.name })); add(textSvg(lx + 45, LY + 53 + i * 34, p.name, { size: 15, weight: 600 })); });
      if (named.length > 5) add(textSvg(lx + 45, LY + 53 + 5 * 34, `+ ${named.length - 5} more`, { size: 14, fill: MUTED, italic: true }));
    }
    if (open) {
      const y = LY + 48 + Math.min(named.length, 5) * 34 + (named.length > 5 ? 34 : 0);
      add(projectSvg({ x: lx + 17, y, code: "P", name: "" }));
      add(textSvg(lx + 45, y + 5, `Project station still to name (${open})`, { size: 15, weight: 600 }));
    }
  }
  return out.join("\n");
}

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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${map.width}" height="${map.height}" viewBox="0 0 ${map.width} ${map.height}" font-family="${FONT}">\n${renderMapInner(map)}\n</svg>`;
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
    const box = labelBox(item);
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
  const boxes = named.map(item => ({ item, box: labelBox(item) }));
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
  if (wrap(map.caption, 88).length > 7) issues.push({ level: "check", message: "The caption is longer than the seven lines the legend has room for." });
  return issues;
}

// ---------- parsing, ids, diffs ----------

const num = (v: unknown, fallback = 0) => typeof v === "number" && Number.isFinite(v) ? Math.max(-10000, Math.min(20000, v)) : fallback;
const str = (v: unknown, max = 300) => typeof v === "string" ? v.slice(0, max) : "";
const pt = (v: unknown): Pt | null => Array.isArray(v) && v.length === 2 ? [num(v[0]), num(v[1])] : null;
const id = (v: unknown) => typeof v === "string" && /^[a-z0-9_-]{1,40}$/i.test(v) ? v : null;
const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T) => list.includes(v as T) ? v as T : fallback;

// Accepts only the shape above, so a bad save can't break the page.
export function parseMap(value: unknown): ResearchMap | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.strands) || !Array.isArray(v.items)) return null;
  const rawAxes = (v.axes || {}) as Record<string, { label?: unknown; color?: unknown }>;
  const color = (c: unknown, fallback: string) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback;
  const defaults = { material: { label: "Material Systems", color: "#C4572B" }, structure: { label: "Structural Logics", color: "#2459A8" }, computation: { label: "Computation & AI", color: "#8E3B8F" } };
  const strands = (v.strands as unknown[]).slice(0, 60).flatMap(s => {
    const r = s as Record<string, unknown>; const sid = id(r.id);
    const points = Array.isArray(r.points) ? r.points.slice(0, 40).map(pt).filter((p): p is Pt => !!p) : [];
    return sid ? [{ id: sid, axis: pick(axes, r.axis, "material"), points }] : [];
  });
  const items = (v.items as unknown[]).slice(0, 400).flatMap(s => {
    const r = s as Record<string, unknown>; const iid = id(r.id); if (!iid) return [];
    const item: Item = { id: iid, name: str(r.name, 120), kind: pick(kinds, r.kind, "concept"), main: r.main === true, x: num(r.x), y: num(r.y), anchor: pick(["start", "middle", "end"] as const, r.anchor, "start") };
    const m = r.marker as Record<string, unknown> | undefined;
    if (m && typeof m === "object") item.marker = { type: pick(markers, m.type, "none"), x: num(m.x), y: num(m.y), ...(typeof m.y2 === "number" ? { y2: num(m.y2) } : {}), ...(id(m.strand) ? { strand: id(m.strand)! } : {}) };
    const f = r.feeds as Record<string, unknown> | undefined;
    if (f && typeof f === "object" && id(f.strand) && pt(f.at)) item.feeds = { strand: id(f.strand)!, at: pt(f.at)!, route: pick(routes, f.route, "under") };
    if (id(r.from)) item.from = id(r.from)!;
    return [item];
  });
  const projects = (Array.isArray(v.projects) ? v.projects : []).slice(0, 60).flatMap(s => {
    const r = s as Record<string, unknown>; const pid = id(r.id); if (!pid) return [];
    const projectId = typeof r.projectId === "string" && /^[0-9a-f-]{36}$/i.test(r.projectId) ? r.projectId : undefined;
    return [{ id: pid, code: str(r.code, 6) || "P", name: str(r.name, 120), x: num(r.x), y: num(r.y), ...(projectId ? { projectId } : {}), ...(str(r.note, 500) ? { note: str(r.note, 500) } : {}) }];
  });
  const columns = (Array.isArray(v.columns) ? v.columns : []).slice(0, 6).map(c => { const r = c as Record<string, unknown>; return { title: str(r.title, 40), subtitle: str(r.subtitle, 80), x0: num(r.x0), x1: num(r.x1) }; });
  const z = v.zone as Record<string, unknown> | null | undefined;
  return {
    version: 1, width: num(v.width, 2400) || 2400, height: num(v.height, 1500) || 1500,
    title: str(v.title, 80) || "Research Framework", subtitle: str(v.subtitle, 200),
    axes: { material: { label: str(rawAxes.material?.label, 40) || defaults.material.label, color: color(rawAxes.material?.color, defaults.material.color) }, structure: { label: str(rawAxes.structure?.label, 40) || defaults.structure.label, color: color(rawAxes.structure?.color, defaults.structure.color) }, computation: { label: str(rawAxes.computation?.label, 40) || defaults.computation.label, color: color(rawAxes.computation?.color, defaults.computation.color) } },
    columns, zone: z && typeof z === "object" ? { x: num(z.x), y: num(z.y), w: Math.max(40, num(z.w, 200)), h: Math.max(40, num(z.h, 120)), title: str(z.title, 40) } : null,
    strands, items, projects, caption: str(v.caption, 1200),
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
  if (JSON.stringify(before.axes) !== JSON.stringify(after.axes)) changes.push("Changed the axes");
  if (JSON.stringify(before.zone) !== JSON.stringify(after.zone)) changes.push("Moved the core zone");
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
