// Connector geometry beyond tldraw's own routing: orthogonal routes that go around boxes in the
// way, and small jumps (hops) where one line crosses another. Plain geometry, testable off-canvas.
export type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

const r2 = (n: number) => Math.round(n * 100) / 100;
const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
const inside = (p: Pt, r: Rect) => p.x > r.x + 1e-6 && p.x < r.x + r.w - 1e-6 && p.y > r.y + 1e-6 && p.y < r.y + r.h - 1e-6;
const grow = (r: Rect, by: number): Rect => ({ x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 });
/** True when an axis-aligned segment passes through a rectangle's interior. */
function blocks(a: Pt, b: Pt, r: Rect) {
  if (Math.abs(a.y - b.y) < 1e-6) {
    const [x1, x2] = a.x < b.x ? [a.x, b.x] : [b.x, a.x];
    return a.y > r.y + 1e-6 && a.y < r.y + r.h - 1e-6 && x1 < r.x + r.w - 1e-6 && x2 > r.x + 1e-6;
  }
  const [y1, y2] = a.y < b.y ? [a.y, b.y] : [b.y, a.y];
  return a.x > r.x + 1e-6 && a.x < r.x + r.w - 1e-6 && y1 < r.y + r.h - 1e-6 && y2 > r.y + 1e-6;
}

/** Remove repeated points and points in the middle of a straight run. */
export function tidy(points: Pt[]) {
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

/**
 * The shortest orthogonal path from `a` to `b` that keeps `pad` clear of every obstacle, preferring
 * fewer bends. Returns null when the obstacles leave no way through.
 */
export function orthogonalRoute(a: Pt, b: Pt, obstacles: Rect[], pad = 16, bendCost = 40): Pt[] | null {
  const rects = obstacles.map(r => grow(r, pad)).filter(r => !inside(a, r) && !inside(b, r));
  const xs = [...new Set([a.x, b.x, ...rects.flatMap(r => [r.x, r.x + r.w]), (a.x + b.x) / 2].map(r2))].sort((p, q) => p - q);
  const ys = [...new Set([a.y, b.y, ...rects.flatMap(r => [r.y, r.y + r.h]), (a.y + b.y) / 2].map(r2))].sort((p, q) => p - q);
  const W = xs.length, H = ys.length;
  const id = (i: number, j: number) => j * W + i;
  const open = (i: number, j: number) => !rects.some(r => inside({ x: xs[i], y: ys[j] }, r));
  const free = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) free[id(i, j)] = open(i, j) ? 1 : 0;
  const start = id(xs.indexOf(r2(a.x)), ys.indexOf(r2(a.y))), goal = id(xs.indexOf(r2(b.x)), ys.indexOf(r2(b.y)));
  // Dijkstra over (node, heading): heading 0 = horizontal, 1 = vertical, 2 = not yet moving.
  const N = W * H * 3;
  const best = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const heap: [number, number][] = [];
  const push = (cost: number, s: number) => {
    heap.push([cost, s]);
    let k = heap.length - 1;
    while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1, r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]]; k = m;
      }
    }
    return top;
  };
  const s0 = start * 3 + 2;
  best[s0] = 0; push(0, s0);
  let found = -1;
  while (heap.length) {
    const [cost, s] = pop();
    if (cost > best[s]) continue;
    const node = Math.floor(s / 3), heading = s % 3;
    if (node === goal) { found = s; break; }
    const i = node % W, j = Math.floor(node / W);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H || !free[id(ni, nj)]) continue;
      const from = { x: xs[i], y: ys[j] }, to = { x: xs[ni], y: ys[nj] };
      if (rects.some(r => blocks(from, to, r))) continue;
      const h = dj === 0 ? 0 : 1;
      const next = cost + dist(from, to) + (heading !== 2 && heading !== h ? bendCost : 0);
      const ns = id(ni, nj) * 3 + h;
      if (next < best[ns]) { best[ns] = next; prev[ns] = s; push(next, ns); }
    }
  }
  if (found < 0) return null;
  const out: Pt[] = [];
  for (let s = found; s >= 0; s = prev[s]) { const node = Math.floor(s / 3); out.push({ x: xs[node % W], y: ys[Math.floor(node / W)] }); }
  return tidy(out.reverse());
}

/**
 * Route a connector around obstacles. The line leaves `start` and reaches `end` along the given
 * directions (unit steps pointing away from each box) for `pad` before turning, as tldraw's elbows do.
 */
export function routeAround(start: Pt, startDir: Pt, end: Pt, endDir: Pt, obstacles: Rect[], pad = 16) {
  const a = { x: start.x + startDir.x * pad, y: start.y + startDir.y * pad };
  const b = { x: end.x + endDir.x * pad, y: end.y + endDir.y * pad };
  const middle = orthogonalRoute(a, b, obstacles, pad * 0.75);
  return middle ? tidy([start, ...middle, end]) : null;
}

/** Where a polyline properly crosses other polylines: segment index, distance along it, and the point. */
export function crossings(points: Pt[], others: Pt[][]) {
  const out: { seg: number; at: number; point: Pt }[] = [];
  for (let s = 0; s < points.length - 1; s++) {
    const p = points[s], q = points[s + 1];
    const rx = q.x - p.x, ry = q.y - p.y;
    for (const other of others) for (let k = 0; k < other.length - 1; k++) {
      const u = other[k], v = other[k + 1];
      const sx = v.x - u.x, sy = v.y - u.y;
      const den = rx * sy - ry * sx;
      if (Math.abs(den) < 1e-9) continue; // parallel lines don't hop
      const t = ((u.x - p.x) * sy - (u.y - p.y) * sx) / den, w = ((u.x - p.x) * ry - (u.y - p.y) * rx) / den;
      if (t <= 1e-6 || t >= 1 - 1e-6 || w <= 1e-6 || w >= 1 - 1e-6) continue;
      out.push({ seg: s, at: t * Math.hypot(rx, ry), point: { x: p.x + rx * t, y: p.y + ry * t } });
    }
  }
  return out.sort((m, n) => m.seg - n.seg || m.at - n.at);
}

/**
 * SVG path through the points with corners rounded by up to `radius`, hopping over each crossing with
 * a half circle of radius `hop`. Hops too close to a corner, an end or another hop are left out.
 */
export function hopPath(points: Pt[], radius: number, hops: { seg: number; at: number }[], hop: number) {
  if (points.length < 2) return "";
  // Trim each corner by its rounding radius, as roundedPath does.
  const trims = points.map((b, i) => {
    if (i === 0 || i === points.length - 1) return 0;
    const r = Math.min(radius, dist(points[i - 1], b) / 2, dist(b, points[i + 1]) / 2);
    return r < 0.5 ? 0 : r;
  });
  let d = `M${r2(points[0].x)},${r2(points[0].y)}`;
  for (let s = 0; s < points.length - 1; s++) {
    const p = points[s], q = points[s + 1], len = dist(p, q);
    if (len < 1e-6) continue;
    const ux = (q.x - p.x) / len, uy = (q.y - p.y) / len;
    const from = trims[s], to = len - trims[s + 1];
    let last = from;
    const sweep = ux > 1e-6 || (Math.abs(ux) <= 1e-6 && uy > 0) ? 1 : 0;
    for (const h of hops.filter(h => h.seg === s)) {
      if (h.at - hop < last + 1 || h.at + hop > to - 1) continue;
      const a = { x: p.x + ux * (h.at - hop), y: p.y + uy * (h.at - hop) }, b = { x: p.x + ux * (h.at + hop), y: p.y + uy * (h.at + hop) };
      d += ` L${r2(a.x)},${r2(a.y)} A${r2(hop)},${r2(hop)} 0 0 ${sweep} ${r2(b.x)},${r2(b.y)}`;
      last = h.at + hop;
    }
    const end = { x: p.x + ux * to, y: p.y + uy * to };
    d += ` L${r2(end.x)},${r2(end.y)}`;
    if (s + 1 < points.length - 1 && trims[s + 1] > 0) {
      const c = points[s + 2], n = dist(q, c);
      const out = { x: q.x + (c.x - q.x) * trims[s + 1] / n, y: q.y + (c.y - q.y) * trims[s + 1] / n };
      d += ` Q${r2(q.x)},${r2(q.y)} ${r2(out.x)},${r2(out.y)}`;
    }
  }
  return d;
}

/** True when an orthogonal polyline runs through any of the rectangles (touching an edge doesn't count). */
export function runsThrough(points: Pt[], rects: Rect[]) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (Math.abs(a.x - b.x) > 1e-6 && Math.abs(a.y - b.y) > 1e-6) continue; // only orthogonal runs are checked
    if (rects.some(r => blocks(a, b, r))) return true;
  }
  return false;
}
