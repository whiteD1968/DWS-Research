/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync('lib/boards/lines.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(() => { throw new Error('no imports'); }, mod, mod.exports);
const l = mod.exports;

test('stored line specs are read defensively', () => {
  assert.equal(l.readLine(undefined), null);
  assert.equal(l.readLine('dashed'), null);
  assert.deepEqual(l.readLine({}), l.DEFAULT_LINE);
  const bad = l.readLine({ weight: 999, pattern: 'zigzag', color: 'red; x', radius: -3, start: 'skull', end: 'tick', startSize: 1, endSize: 100 });
  assert.deepEqual(bad, { weight: 12, pattern: 'solid', color: '#111111', radius: 0, start: 'none', end: 'tick', startSize: 2, endSize: 40 });
  assert.equal(l.readLine({ color: '#C2413A' }).color, '#c2413a');
});

test('weights are points; dashes scale with heavier lines and solid has none', () => {
  assert.equal(l.PT, 4 / 3);
  assert.equal(l.dashArray('solid', 1), undefined);
  assert.equal(l.dashArray('dashed', 0.5), '6 4');
  assert.equal(l.dashArray('dashed', 3), '24 16');
  assert.equal(l.dashArray('center', 0.35), '18 4 3 4');
  for (const p of l.PATTERNS) if (p.id !== 'solid') assert.ok(l.dashArray(p.id, 1), p.id);
});

test('elbow routes lose duplicate and collinear points', () => {
  const pts = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }, { x: 100, y: 80 }];
  assert.deepEqual(l.simplify(pts), [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }]);
});

test('corners round by the radius, limited to half of the shorter leg', () => {
  const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 10 }];
  assert.equal(l.roundedPath(pts, 0), 'M0,0 L100,0 L100,10');
  assert.equal(l.roundedPath(pts, 8), 'M0,0 L95,0 Q100,0 100,5 L100,10');
  assert.equal(l.roundedPath([{ x: 0, y: 0 }], 4), '');
});

test('line ends are trimmed under closed arrowheads only', () => {
  assert.equal(l.endInset('arrow', 10), 8);
  assert.equal(l.endInset('dot', 10), 0);
  assert.equal(l.endInset('tick', 10), 0);
  const t = l.trimEnds([{ x: 0, y: 0 }, { x: 100, y: 0 }], 0, 8);
  assert.deepEqual(t, [{ x: 0, y: 0 }, { x: 92, y: 0 }]);
  assert.deepEqual(l.trimEnds([{ x: 0, y: 0 }, { x: 5, y: 0 }], 0, 8), [{ x: 0, y: 0 }, { x: 5, y: 0 }], 'too short to trim');
});

test('end marks point along the line', () => {
  const arrow = l.endMark('arrow', { x: 100, y: 0 }, { x: 0, y: 0 }, 10);
  assert.equal(arrow.d, 'M100,0 L90,4.2 L90,-4.2 Z');
  assert.equal(arrow.fill, true);
  const tick = l.endMark('tick', { x: 0, y: 0 }, { x: -50, y: 0 }, 8);
  assert.equal(tick.d, 'M-4,-4 L4,4');
  assert.deepEqual(l.endMark('dot', { x: 3, y: 4 }, { x: 0, y: 0 }, 6), { kind: 'circle', cx: 3, cy: 4, r: 3, fill: true });
  assert.equal(l.endMark('none', { x: 0, y: 0 }, { x: 1, y: 0 }, 6), null);
  for (const e of l.ENDS) if (e.id !== 'none') assert.ok(l.endMark(e.id, { x: 0, y: 0 }, { x: 0, y: 10 }, 6), e.id);
});

test('built-in styles are valid, and saved styles drop junk', () => {
  for (const s of l.BUILT_IN_STYLES) assert.deepEqual(l.readLine(s.line), s.line, s.id);
  assert.deepEqual(l.parseStyles('nope'), []);
  const saved = l.parseStyles(JSON.stringify([{ id: '1', name: 'Section cut', line: { weight: 2, pattern: 'solid' } }, { id: 2 }, null]));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].line.weight, 2);
});

test('box specs fall back to the original headed box', () => {
  assert.deepEqual(l.readBox(undefined), l.DEFAULT_BOX);
  assert.equal(l.DEFAULT_BOX.header, 28);
  assert.deepEqual(l.readBox({ weight: 0.5, pattern: 'dashed', header: 0 }), { weight: 0.5, pattern: 'dashed', color: '#3a3a37', header: 0 });
  assert.equal(l.readBox({ header: 13 }).header, 28);
});
