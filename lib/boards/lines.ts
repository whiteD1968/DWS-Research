// Precise line drawing for connectors: weights in points, drafting line types, exact colours,
// rounded elbows and sized line ends. Kept as plain geometry so it can be tested off-canvas.
export type LinePattern = "solid" | "dashed" | "longdash" | "dotted" | "center" | "hidden" | "phantom";
export type LineEnd = "none" | "arrow" | "open" | "dot" | "circle" | "tick" | "bar" | "diamond" | "socket" | "xnode";
export type LineSpec = {
  weight: number; pattern: LinePattern; color: string; radius: number; start: LineEnd; end: LineEnd; startSize: number; endSize: number;
  /** Elbow lines find their own way around boxes in the way. */
  avoid?: boolean;
  /** Hop over lines beneath this one where they cross. */
  jumps?: boolean;
};
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
  { id: "socket", label: "Socket (cup)" }, { id: "xnode", label: "Circled X (node)" },
];
export const LINE_COLORS = ["#111111", "#3a3a37", "#6b6d66", "#9a9c95", "#c4c5bf", "#ffffff", "#d4f53c", "#c2413a", "#3c64c8"];

export const DEFAULT_LINE: LineSpec = { weight: 0.5, pattern: "solid", color: "#111111", radius: 4, start: "none", end: "arrow", startSize: 6, endSize: 6, avoid: false, jumps: false };

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
    avoid: v.avoid === true, jumps: v.jumps === true,
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
  return end === "arrow" ? size * 0.8 : end === "diamond" ? size * 1.6 : end === "circle" ? size : end === "xnode" ? size / 2 : 0;
}

export type EndMark = { kind: "path"; d: string; fill: boolean } | { kind: "circle"; cx: number; cy: number; r: number; fill: boolean; cross?: string };
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
    // Socket: a half circle around the end, open away from the line, ready to take a plug.
    case "socket": return { kind: "path", d: `M${at(s * 0.5, s * 0.5)} A${r2(s / 2)},${r2(s / 2)} 0 0 0 ${at(s * 0.5, -s * 0.5)}`, fill: false };
    // Node: an open circle with an X, centred on the end point.
    case "xnode": {
      const k = s / 2 * 0.62;
      return { kind: "circle", cx: r2(tip.x), cy: r2(tip.y), r: r2(s / 2), fill: false, cross: `M${r2(tip.x - k)},${r2(tip.y - k)} L${r2(tip.x + k)},${r2(tip.y + k)} M${r2(tip.x - k)},${r2(tip.y + k)} L${r2(tip.x + k)},${r2(tip.y - k)}` };
    }
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
export type BoxCorner = "square" | "round" | "chamfer" | "chamfer4";
/** One corner's shape, for boxes whose corners differ (top-left, top-right, bottom-right, bottom-left). */
export type CornerKind = "square" | "round" | "cut";
/** Where a side's hatched band runs, following the outline clockwise from the top-left. */
export type SideHatch = "full" | "start" | "end" | "ends" | "middle" | "none";
export type BoxSpec = {
  weight: number; pattern: LinePattern; color: string; header: number; corner: BoxCorner; cut: number; hatch: number; fill: string; shadow: number;
  /** Per-corner shapes; null follows `corner`. */
  corners: CornerKind[] | null;
  /** Hatched runs for the top, right, bottom and left sides. */
  sides: SideHatch[];
};
export const CORNER_KINDS: { id: CornerKind; label: string }[] = [{ id: "square", label: "Square" }, { id: "round", label: "Rounded" }, { id: "cut", label: "Cut" }];
export const SIDE_HATCHES: { id: SideHatch; label: string }[] = [
  { id: "full", label: "Full" }, { id: "start", label: "Start" }, { id: "end", label: "End" }, { id: "ends", label: "Both ends" }, { id: "middle", label: "Middle" }, { id: "none", label: "None" },
];
const ALL_SIDES: SideHatch[] = ["full", "full", "full", "full"];
export const HEADERS = [{ h: 0, label: "None" }, { h: 8, label: "Thin" }, { h: 16, label: "Medium" }, { h: 28, label: "Titled" }];
export const CORNERS: { id: BoxCorner; label: string }[] = [
  { id: "square", label: "Square" }, { id: "round", label: "Rounded" }, { id: "chamfer", label: "Cut corners (2)" }, { id: "chamfer4", label: "Cut corners (4)" },
];
export const HATCHES = [0, 6, 10, 16];
export const BOX_FILLS = ["#ffffff", "none", "#111111", "#f4f3ef", "#e9e9e7", "#d4f53c", "#1f3a4d"];
export const SHADOWS = [0, 6, 12, 20];
export const DEFAULT_BOX: BoxSpec = { weight: 0.75, pattern: "solid", color: "#3a3a37", header: 28, corner: "square", cut: 24, hatch: 0, fill: "#ffffff", shadow: 0, corners: null, sides: ALL_SIDES };
export function readBox(value: unknown): BoxSpec {
  if (!value || typeof value !== "object") return DEFAULT_BOX;
  const v = value as Record<string, unknown>;
  return {
    weight: clamp(v.weight, 0.1, 12, DEFAULT_BOX.weight),
    pattern: PATTERNS.some(p => p.id === v.pattern) ? v.pattern as LinePattern : DEFAULT_BOX.pattern,
    color: typeof v.color === "string" && HEX.test(v.color) ? v.color.toLowerCase() : DEFAULT_BOX.color,
    header: HEADERS.some(h => h.h === v.header) ? v.header as number : DEFAULT_BOX.header,
    corner: CORNERS.some(c => c.id === v.corner) ? v.corner as BoxCorner : DEFAULT_BOX.corner,
    cut: clamp(v.cut, 0, 200, DEFAULT_BOX.cut),
    hatch: clamp(v.hatch, 0, 60, DEFAULT_BOX.hatch),
    fill: v.fill === "none" ? "none" : typeof v.fill === "string" && HEX.test(v.fill) ? v.fill.toLowerCase() : DEFAULT_BOX.fill,
    shadow: clamp(v.shadow, 0, 60, DEFAULT_BOX.shadow),
    corners: Array.isArray(v.corners) && v.corners.length === 4 && v.corners.every(c => CORNER_KINDS.some(k => k.id === c)) ? [...v.corners] as CornerKind[] : null,
    sides: Array.isArray(v.sides) && v.sides.length === 4 && v.sides.every(x => SIDE_HATCHES.some(k => k.id === x)) ? [...v.sides] as SideHatch[] : ALL_SIDES,
  };
}
/** True for dark fills, so text on them turns light. */
export function isDark(hex: string) {
  if (!HEX.test(hex)) return false;
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) < 110;
}

/** The four corner shapes (top-left, top-right, bottom-right, bottom-left) a box spec draws. */
export function cornerKinds(corner: BoxCorner, corners?: CornerKind[] | null): CornerKind[] {
  if (corners && corners.length === 4) return corners;
  if (corner === "round") return ["round", "round", "round", "round"];
  if (corner === "chamfer") return ["cut", "square", "cut", "square"];
  if (corner === "chamfer4") return ["cut", "cut", "cut", "cut"];
  return ["square", "square", "square", "square"];
}
/** Outline of a box inset by `i`; each corner is square, rounded or cut. */
export function boxPath(w: number, h: number, corner: BoxCorner | CornerKind[], cut: number, i = 0) {
  const kinds = Array.isArray(corner) ? cornerKinds("square", corner) : cornerKinds(corner);
  const x0 = i, y0 = i, x1 = w - i, y1 = h - i;
  const c = Math.max(0, Math.min(cut - i * 0.6, (x1 - x0) / 2, (y1 - y0) / 2));
  if (c <= 0 || kinds.every(k => k === "square")) return `M${r2(x0)},${r2(y0)} H${r2(x1)} V${r2(y1)} H${r2(x0)} Z`;
  // Each corner: the point where it leaves the incoming side, then how it reaches the outgoing side.
  const corners: [number, number, number, number, number, number][] = [
    // [cornerX, cornerY, inX, inY, outX, outY] with in/out as unit steps along the sides
    [x0, y0, 0, 1, 1, 0], [x1, y0, -1, 0, 0, 1], [x1, y1, 0, -1, -1, 0], [x0, y1, 1, 0, 0, -1],
  ];
  const parts: string[] = [];
  corners.forEach(([cx, cy, ix, iy, ox, oy], n) => {
    const k = kinds[n];
    const a = `${r2(cx + ix * c)},${r2(cy + iy * c)}`, b = `${r2(cx + ox * c)},${r2(cy + oy * c)}`;
    if (k === "square") parts.push(`${n ? "L" : "M"}${r2(cx)},${r2(cy)}`);
    else if (k === "round") parts.push(`${n ? "L" : "M"}${a} Q${r2(cx)},${r2(cy)} ${b}`);
    else parts.push(`${n ? "L" : "M"}${a} L${b}`);
  });
  return `${parts.join(" ")} Z`;
}
/** Rectangles (x, y, w, h) covering the hatched runs of each side, for masking the hatch band. */
export function hatchRuns(w: number, h: number, band: number, sides: SideHatch[]) {
  const spans = (s: SideHatch): [number, number][] =>
    s === "full" ? [[0, 1]] : s === "start" ? [[0, 0.45]] : s === "end" ? [[0.55, 1]] : s === "ends" ? [[0, 0.25], [0.75, 1]] : s === "middle" ? [[0.3, 0.7]] : [];
  const out: { x: number; y: number; w: number; h: number }[] = [];
  const b = Math.max(0, band) + 1;
  spans(sides[0]).forEach(([a, z]) => out.push({ x: a * w, y: 0, w: (z - a) * w, h: b }));
  spans(sides[1]).forEach(([a, z]) => out.push({ x: w - b, y: a * h, w: b, h: (z - a) * h }));
  spans(sides[2]).forEach(([a, z]) => out.push({ x: (1 - z) * w, y: h - b, w: (z - a) * w, h: b }));
  spans(sides[3]).forEach(([a, z]) => out.push({ x: 0, y: (1 - z) * h, w: b, h: (z - a) * h }));
  return out.map(r => ({ x: r2(r.x), y: r2(r.y), w: r2(r.w), h: r2(r.h) }));
}
