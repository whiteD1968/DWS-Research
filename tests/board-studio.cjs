/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync('lib/boards/studio.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(() => { throw new Error('no imports'); }, mod, mod.exports);
const s = mod.exports;

test('inks accept only hex colours', () => {
  assert.equal(s.ink('#D4F53C'), '#d4f53c');
  assert.equal(s.ink('red'), '#111111');
  assert.equal(s.ink(undefined, '#9a9c95'), '#9a9c95');
  for (const i of s.STUDIO_INKS) assert.equal(s.ink(i.id), i.id);
});

test('rating squares fill from the left, sit at the right edge and leave room for the label', () => {
  const r = s.ratingCells(280, 22, 3, 5);
  assert.equal(r.cells.length, 5);
  assert.deepEqual(r.cells.map(c => c.on), [true, true, true, false, false]);
  const last = r.cells[4];
  assert.ok(Math.abs(last.x + r.size - 280) < 1e-9);
  assert.ok(r.labelWidth > 100);
  assert.ok(r.cells.every(c => c.y >= 0 && c.y + r.size <= 22));
  // Out-of-range values are clamped.
  assert.equal(s.ratingCells(280, 22, 9, 5).cells.filter(c => c.on).length, 5);
  assert.equal(s.ratingCells(280, 22, -2, 5).cells.filter(c => c.on).length, 0);
  assert.equal(s.ratingCells(280, 22, 1, 40).cells.length, 10);
});

test('clicking the top filled square steps the rating back', () => {
  assert.equal(s.nextRating(3, 5), 5);
  assert.equal(s.nextRating(3, 3), 2);
  assert.equal(s.nextRating(1, 1), 0);
});

test('study grids put crosses inside and T ticks on the edges', () => {
  const g = s.gridMarks(900, 300, 3, 9);
  assert.equal(g.xs.length, 10); assert.equal(g.ys.length, 4);
  assert.equal(g.crosses.length, 8 * 2);
  assert.equal(g.ticks.length, 8 * 2 + 2 * 2);
  assert.ok(g.ticks.some(t => t.side === 'top' && t.y === 0));
  assert.ok(g.ticks.some(t => t.side === 'right' && t.x === 900));
  assert.equal(s.gridMarks(100, 100, 0, 99).cols, 20);
});

test('corner brackets draw four L marks with arms capped at half a side', () => {
  const d = s.bracketPath(200, 100, 14);
  assert.equal((d.match(/M/g) || []).length, 4);
  assert.match(d, /^M14,0 H0 V14/);
  assert.match(s.bracketPath(20, 10, 40), /^M5,0 H0 V5/);
});

test('asterisks mark accent letters in a label, and truncation counts visible letters', () => {
  assert.deepEqual(s.accentRuns('S *D*'), [{ text: 'S ', accent: false }, { text: 'D', accent: true }]);
  assert.deepEqual(s.accentRuns('F+*E*'), [{ text: 'F+', accent: false }, { text: 'E', accent: true }]);
  assert.deepEqual(s.accentRuns('Plain'), [{ text: 'Plain', accent: false }]);
  assert.deepEqual(s.accentRuns('a*b'), [{ text: 'a*b', accent: false }]); // a lone asterisk stays as typed
  assert.deepEqual(s.accentRuns('ABC *DEF*', 5), [{ text: 'ABC ', accent: false }, { text: 'D', accent: true }]);
});
