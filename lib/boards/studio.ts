// Studio drawing pieces from the way the studio communicates through drawing: rating meters,
// study grids with registration marks, and big numerals. Plain geometry, testable off-canvas.
export const STUDIO_INKS = [
  { id: "#f4f3ef", label: "White" }, { id: "#111111", label: "Black" }, { id: "#d4f53c", label: "Signal green" },
  { id: "#9a9c95", label: "Grey" }, { id: "#c2413a", label: "Red" },
];
const HEX = /^#[0-9a-f]{6}$/i;
export const ink = (value: unknown, fallback = "#111111") => typeof value === "string" && HEX.test(value) ? value.toLowerCase() : fallback;

/** Squares for an n-of-max rating, laid out from the right edge of a w × h row. */
export function ratingCells(w: number, h: number, value: number, max: number) {
  const n = Math.max(1, Math.min(10, Math.round(max)));
  const filled = Math.max(0, Math.min(n, Math.round(value)));
  const size = Math.max(4, Math.min(h * 0.62, (w * 0.5) / (n * 1.35)));
  const gap = size * 0.35;
  const total = n * size + (n - 1) * gap;
  const x0 = w - total, y = (h - size) / 2;
  return { size, labelWidth: Math.max(0, x0 - size), cells: Array.from({ length: n }, (_, i) => ({ x: x0 + i * (size + gap), y, on: i < filled })) };
}

/** Value for a click on a rating square: clicking the current top square clears it back one step. */
export function nextRating(current: number, clicked: number) {
  return clicked === current ? clicked - 1 : clicked;
}

/** Cell lines and registration marks for a rows × cols study grid. */
export function gridMarks(w: number, h: number, rows: number, cols: number) {
  const r = Math.max(1, Math.min(20, Math.round(rows))), c = Math.max(1, Math.min(20, Math.round(cols)));
  const xs = Array.from({ length: c + 1 }, (_, i) => +(i * w / c).toFixed(2));
  const ys = Array.from({ length: r + 1 }, (_, i) => +(i * h / r).toFixed(2));
  const crosses: { x: number; y: number }[] = [];
  const ticks: { x: number; y: number; side: "top" | "bottom" | "left" | "right" }[] = [];
  xs.forEach((x, i) => ys.forEach((y, j) => {
    const edgeX = i === 0 || i === c, edgeY = j === 0 || j === r;
    if (!edgeX && !edgeY) crosses.push({ x, y });
    else if (edgeY && !edgeX) ticks.push({ x, y, side: j === 0 ? "top" : "bottom" });
    else if (edgeX && !edgeY) ticks.push({ x, y, side: i === 0 ? "left" : "right" });
  }));
  return { xs, ys, crosses, ticks, rows: r, cols: c };
}

export type NumeralStyle = "hatch" | "outline" | "solid";
export const NUMERAL_STYLES: { id: NumeralStyle; label: string }[] = [{ id: "hatch", label: "Hatched" }, { id: "outline", label: "Outline" }, { id: "solid", label: "Solid" }];

/** Four L-shaped corner marks framing a w × h area, each arm `arm` long (capped at half a side). */
export function bracketPath(w: number, h: number, arm: number) {
  const a = Math.max(2, Math.min(arm, w / 2, h / 2));
  const r = (n: number) => +n.toFixed(2);
  return [
    `M${r(a)},0 H0 V${r(a)}`, `M${r(w - a)},0 H${r(w)} V${r(a)}`,
    `M${r(w)},${r(h - a)} V${r(h)} H${r(w - a)}`, `M${r(a)},${r(h)} H0 V${r(h - a)}`,
  ].join(" ");
}
