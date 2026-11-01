/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync('lib/boards/routing.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(() => { throw new Error('no imports'); }, mod, mod.exports);
const r = mod.exports;

const hits = (a, b, rect) => {
  // Does the axis-aligned segment a→b pass through the rectangle's interior?
  if (a.y === b.y) return a.y > rect.y && a.y < rect.y + rect.h && Math.min(a.x, b.x) < rect.x + rect.w && Math.max(a.x, b.x) > rect.x;
  return a.x > rect.x && a.x < rect.x + rect.w && Math.min(a.y, b.y) < rect.y + rect.h && Math.max(a.y, b.y) > rect.y;
};
const orthogonal = pts => pts.every((p, i) => i === 0 || p.x === pts[i - 1].x || p.y === pts[i - 1].y);

test('a clear way stays a straight line', () => {
  assert.deepEqual(r.orthogonalRoute({ x: 0, y: 0 }, { x: 300, y: 0 }, []), [{ x: 0, y: 0 }, { x: 300, y: 0 }]);
});

test('a box in the way is walked around with clearance and few bends', () => {
  const box = { x: 100, y: -50, w: 100, h: 100 };
  const route = r.orthogonalRoute({ x: 0, y: 0 }, { x: 300, y: 0 }, [box], 16);
  assert.ok(route, 'found a route');
  assert.ok(orthogonal(route));
  const padded = { x: box.x - 16 + 0.01, y: box.y - 16 + 0.01, w: box.w + 31.98, h: box.h + 31.98 };
  for (let i = 1; i < route.length; i++) assert.ok(!hits(route[i - 1], route[i], padded), `segment ${i} clears the box`);
  assert.ok(route.length <= 6, `few bends (${route.length - 2})`);
  assert.deepEqual(route[0], { x: 0, y: 0 }); assert.deepEqual(route[route.length - 1], { x: 300, y: 0 });
});

test('a fully walled-in end has no route', () => {
  const walls = [{ x: 200, y: -200, w: 400, h: 40 }, { x: 200, y: 160, w: 400, h: 40 }, { x: 200, y: -200, w: 40, h: 400 }, { x: 560, y: -200, w: 40, h: 400 }];
  assert.equal(r.orthogonalRoute({ x: 0, y: 0 }, { x: 400, y: 0 }, walls, 10), null);
});

test('routeAround leaves and arrives perpendicular to the boxes', () => {
  const route = r.routeAround({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 400, y: 100 }, { x: -1, y: 0 }, [{ x: 150, y: -60, w: 100, h: 220 }], 16);
  assert.ok(route && orthogonal(route));
  assert.equal(route[1].y, 0); // first run is horizontal, out of the start box
  assert.equal(route[route.length - 2].y, 100); // last run is horizontal, into the end box
});

test('crossings are found in order along the line, and touching or parallel lines are not crossings', () => {
  const line = [{ x: 0, y: 0 }, { x: 300, y: 0 }];
  const xs = r.crossings(line, [[{ x: 200, y: -50 }, { x: 200, y: 50 }], [{ x: 100, y: -50 }, { x: 100, y: 50 }], [{ x: 0, y: 10 }, { x: 300, y: 10 }], [{ x: 300, y: -10 }, { x: 300, y: 10 }]]);
  assert.deepEqual(xs.map(c => c.at), [100, 200]);
  assert.deepEqual(xs[0].point, { x: 100, y: 0 });
});

test('hop paths add a half circle at each crossing and match plain paths without them', () => {
  const pts = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }];
  const plain = r.hopPath(pts, 8, [], 5);
  assert.equal((plain.match(/A/g) || []).length, 0);
  assert.equal((plain.match(/Q/g) || []).length, 1);
  const hopped = r.hopPath(pts, 8, [{ seg: 0, at: 150 }, { seg: 1, at: 100 }], 5);
  assert.equal((hopped.match(/A/g) || []).length, 2);
  assert.match(hopped, /L145,0 A5,5 0 0 1 155,0/); // rightward hops bump up
  // Hops too close to a corner are skipped.
  assert.equal((r.hopPath(pts, 8, [{ seg: 0, at: 296 }], 5).match(/A/g) || []).length, 0);
});

test('a route is only redone when it runs through a box, not when it passes close by', () => {
  const route = [{ x: 0, y: 0 }, { x: 300, y: 0 }];
  assert.equal(r.runsThrough(route, [{ x: 100, y: -50, w: 50, h: 100 }]), true);
  assert.equal(r.runsThrough(route, [{ x: 100, y: -50, w: 50, h: 45 }]), false);
  assert.equal(r.runsThrough(route, [{ x: 100, y: 0, w: 50, h: 45 }]), false); // along an edge
});
