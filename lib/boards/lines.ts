// Precise line drawing for connectors: weights in points, drafting line types, exact colours,
// rounded elbows and sized line ends. Kept as plain geometry so it can be tested off-canvas.
export type LinePattern = "solid" | "dashed" | "longdash" | "dotted" | "center" | "hidden" | "phantom";
export type LineEnd = "none" | "arrow" | "open" | "dot" | "circle" | "tick" | "bar" | "diamond";
export type LineSpec = { weight: number; pattern: LinePattern; color: string; radius: number; start: LineEnd; end: LineEnd; startSize: number; endSize: number };
type Pt = { x: number; y: number };

export const PT = 4 / 3; // canvas units (CSS px) per point
export const WEIGHTS = [0.25, 0.35, 0.5, 0.75, 1, 1.4, 2, 3, 4];
export const END_SIZES = [4, 6, 8, 10, 14, 18];
export const RADII = [0, 2, 4, 8, 12, 20];
export const PATTERNS: { id: LinePattern; label: string }[] = [
  { id: "solid", label: "Solid" }, { id: "dashed", label: "Dashed" }, { id: "longdash", label: "Long dash" },
  { id: "dotted", label: "Dotted" }, { id: "hidden", label: "Hidden (short dash)" }, { id: "center", label: "Centreline" }, { id: "phantom", label: "Phantom" },
];
export const ENDS: { id: LineEnd; label: string }[] = [
  { id: "none", label: "None" }, { id: "arrow", label: "Arrow" }, { id: "open", label: "Open arrow" }, { id: "dot", label: "Dot" },
  { id: "circle", label: "Circle" }, { id: "tick", label: "Tick (architectural)" }, { id: "bar", label: "Bar" }, { id: "diamond", label: "Diamond" },
];
export const LINE_COLORS = ["#111111", "#3a3a37", "#6b6d66", "#9a9c95", "#c4c5bf", "#c2413a", "#3c64c8"];

export const DEFAULT_LINE: LineSpec = { weight: 0.5, pattern: "solid", color: "#111111", radius: 4, start: "none", end: "arrow", startSize: 6, endSize: 6 };

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (n: unknown, lo: number, hi: number, fallback: number) => typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
/** Read a stored line spec defensively; anything missing or invalid falls back to the default. */
export function readLine(value: unknown): LineSpec | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const pattern = PATTERNS.some(p => p.id === v.pattern) ? v.pattern as LinePattern : DEFAULT_LINE.pattern;
  const end = (x: unknown, d: LineEnd) => ENDS.some(e => e.id === x) ? x as LineEnd : d;
  return {
    weight: clamp(v.weight, 0.1, 12, DEFAULT_LINE.weight), pattern,
    color: typeof v.color === "string" && HEX.test(v.color) ? v.color.toLowerCase() : DEFAULT_LINE.color,
    radius: clamp(v.radius, 0, 60, DEFAULT_LINE.radius),
    start: end(v.start, DEFAULT_LINE.start), end: end(v.end, DEFAULT_LINE.end),
    startSize: clamp(v.startSize, 2, 40, DEFAULT_LINE.startSize), endSize: clamp(v.endSize, 2, 40, DEFAULT_LINE.endSize),
  };
}

/** Dash array in canvas units. Dashes grow with heavier lines so a pattern keeps its character. */
export function dashArray(pattern: LinePattern, weight: number) {
  const k = Math.max(1, weight * PT);
  const scale = (xs: number[]) => xs.map(x => +(x * k).toFixed(2)).join(" ");
  switch (pattern) {
    case "solid": return undefined;
    case "dashed": return scale([6, 4]);
    case "longdash": return scale([14, 5]);
    case "hidden": return scale([3, 2.5]);
    case "dotted": return scale([0.01, 3]);
    case "center": return scale([18, 4, 3, 4]);
    case "phantom": return scale([18, 4, 3, 4, 3, 4]);
  }
}

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Drop repeated and collinear points, which elbow routes include for their handles. */
export function simplify(points: Pt[]) {
  const out: Pt[] = [];
  for (const p of points) {
    if (out.length && dist(out[out.length - 1], p) < 0.01) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2], b = out[out.length - 1];
      if (Math.abs((b.x - a.x) * (p.y - b.y) - (b.y - a.y) * (p.x - b.x)) < 0.01) { out[out.length - 1] = p; continue; }
    }
    out.push(p);
  }
  return out;
}

/** Pull a polyline's ends back so a filled arrowhead's tip, not the line, reaches the target. */
export function trimEnds(points: Pt[], startBy: number, endBy: number) {
  const pts = points.map(p => ({ ...p }));
  const pull = (i: number, j: number, by: number) => {
    const d = dist(pts[i], pts[j]);
    if (by <= 0 || d <= by + 0.5) return;
    pts[i] = { x: pts[i].x + (pts[j].x - pts[i].x) * by / d, y: pts[i].y + (pts[j].y - pts[i].y) * by / d };
  };
  if (pts.length >= 2) { pull(0, 1, startBy); pull(pts.length - 1, pts.length - 2, endBy); }
  return pts;
}

/** SVG path through the points, with each corner rounded by up to `radius`. */
export function roundedPath(points: Pt[], radius: number) {
  if (points.length < 2) return "";
  let d = `M${r2(points[0].x)},${r2(points[0].y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const r = Math.min(radius, dist(a, b) / 2, dist(b, c) / 2);
    if (r < 0.5) { d += ` L${r2(b.x)},${r2(b.y)}`; continue; }
    const p1 = { x: b.x + (a.x - b.x) * r / dist(a, b), y: b.y + (a.y - b.y) * r / dist(a, b) };
    const p2 = { x: b.x + (c.x - b.x) * r / dist(b, c), y: b.y + (c.y - b.y) * r / dist(b, c) };
    d += ` L${r2(p1.x)},${r2(p1.y)} Q${r2(b.x)},${r2(b.y)} ${r2(p2.x)},${r2(p2.y)}`;
  }
  const last = points[points.length - 1];
  return `${d} L${r2(last.x)},${r2(last.y)}`;
}

/** How far to pull the line back under each end so it does not poke through a closed shape. */
export function endInset(end: LineEnd, size: number) {
  return end === "arrow" ? size * 0.8 : end === "diamond" ? size * 1.6 : end === "circle" ? size / 2 : 0;
}

export type EndMark = { kind: "path"; d: string; fill: boolean } | { kind: "circle"; cx: number; cy: number; r: number; fill: boolean };
/** Geometry for one line end. `tip` is the end point; `from` is a point back along the line, giving direction. */
export function endMark(end: LineEnd, tip: Pt, from: Pt, size: number): EndMark | null {
  if (end === "none") return null;
  const len = dist(tip, from) || 1;
  const ux = (tip.x - from.x) / len, uy = (tip.y - from.y) / len; // along the line, towards the tip
  const nx = -uy, ny = ux; // across the line
  const at = (along: number, across: number) => `${r2(tip.x + ux * along + nx * across)},${r2(tip.y + uy * along + ny * across)}`;
  const s = size;
  switch (end) {
    case "arrow": return { kind: "path", d: `M${at(0, 0)} L${at(-s, s * 0.42)} L${at(-s, -s * 0.42)} Z`, fill: true };
    case "open": return { kind: "path", d: `M${at(-s, s * 0.5)} L${at(0, 0)} L${at(-s, -s * 0.5)}`, fill: false };
    case "diamond": return { kind: "path", d: `M${at(0, 0)} L${at(-s * 0.8, s * 0.4)} L${at(-s * 1.6, 0)} L${at(-s * 0.8, -s * 0.4)} Z`, fill: true };
    case "bar": return { kind: "path", d: `M${at(0, s * 0.6)} L${at(0, -s * 0.6)}`, fill: false };
    // Architectural tick: a short 45° slash through the end point.
    case "tick": return { kind: "path", d: `M${at(-s * 0.5, -s * 0.5)} L${at(s * 0.5, s * 0.5)}`, fill: false };
    case "dot": return { kind: "circle", cx: r2(tip.x), cy: r2(tip.y), r: r2(s / 2), fill: true };
    case "circle": return { kind: "circle", cx: r2(tip.x - ux * s / 2), cy: r2(tip.y - uy * s / 2), r: r2(s / 2), fill: false };
  }
}

// ---------- Line styles: named sets, like a pen set ----------
export type LineStyle = { id: string; name: string; line: LineSpec; builtIn?: boolean };
export const BUILT_IN_STYLES: LineStyle[] = [
  { id: "primary-flow", name: "Primary flow (heavy dashed)", builtIn: true, line: { weight: 1.4, pattern: "dashed", color: "#111111", radius: 6, start: "dot", end: "arrow", startSize: 8, endSize: 8 } },
  { id: "secondary-flow", name: "Secondary flow (fine dashed)", builtIn: true, line: { weight: 0.5, pattern: "dashed", color: "#111111", radius: 6, start: "dot", end: "arrow", startSize: 6, endSize: 5 } },
  { id: "reference", name: "Reference (grey hidden)", builtIn: true, line: { weight: 0.5, pattern: "hidden", color: "#6b6d66", radius: 6, start: "none", end: "arrow", startSize: 6, endSize: 5 } },
  { id: "fine-solid", name: "Fine solid", builtIn: true, line: { weight: 0.35, pattern: "solid", color: "#111111", radius: 0, start: "none", end: "arrow", startSize: 6, endSize: 6 } },
  { id: "dimension", name: "Dimension (ticks)", builtIn: true, line: { weight: 0.35, pattern: "solid", color: "#111111", radius: 0, start: "tick", end: "tick", startSize: 8, endSize: 8 } },
  { id: "centreline", name: "Centreline", builtIn: true, line: { weight: 0.35, pattern: "center", color: "#3a3a37", radius: 0, start: "none", end: "none", startSize: 6, endSize: 6 } },
];
export const STYLES_KEY = "dws-line-styles";
export function parseStyles(raw: string | null): LineStyle[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.flatMap(s => {
      const line = s && typeof s.id === "string" && typeof s.name === "string" ? readLine(s.line) : null;
      return line ? [{ id: s.id, name: s.name.slice(0, 60), line }] : [];
    });
  } catch { return []; }
}

// ---------- Box outline and header ----------
export type BoxSpec = { weight: number; pattern: LinePattern; color: string; header: number };
export const HEADERS = [{ h: 0, label: "None" }, { h: 8, label: "Thin" }, { h: 16, label: "Medium" }, { h: 28, label: "Titled" }];
export const DEFAULT_BOX: BoxSpec = { weight: 0.75, pattern: "solid", color: "#3a3a37", header: 28 };
export function readBox(value: unknown): BoxSpec {
  if (!value || typeof value !== "object") return DEFAULT_BOX;
  const v = value as Record<string, unknown>;
  return {
    weight: clamp(v.weight, 0.1, 12, DEFAULT_BOX.weight),
    pattern: PATTERNS.some(p => p.id === v.pattern) ? v.pattern as LinePattern : DEFAULT_BOX.pattern,
    color: typeof v.color === "string" && HEX.test(v.color) ? v.color.toLowerCase() : DEFAULT_BOX.color,
    header: HEADERS.some(h => h.h === v.header) ? v.header as number : DEFAULT_BOX.header,
  };
}
