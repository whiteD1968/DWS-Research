/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync('lib/boards/diagram.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(() => { throw new Error('no imports'); }, mod, mod.exports);
const d = mod.exports;

test('quick-add places a same-size box one gap away on each side', () => {
  const box = { x: 100, y: 50, w: 200, h: 140 };
  assert.deepEqual(d.quickAddPosition(box, 'right'), { x: 420, y: 50 });
  assert.deepEqual(d.quickAddPosition(box, 'left'), { x: -220, y: 50 });
  assert.deepEqual(d.quickAddPosition(box, 'bottom'), { x: 100, y: 310 });
  assert.deepEqual(d.quickAddPosition(box, 'top', 40), { x: 100, y: -130 });
});

test('connector presets use valid tldraw styles and include the graph.pdf style', () => {
  const heads = ['none', 'dot', 'arrow', 'bar', 'diamond'];
  for (const p of d.CONNECTOR_PRESETS) {
    assert.ok(['arc', 'elbow'].includes(p.kind));
    assert.ok(['draw', 'solid', 'dashed', 'dotted'].includes(p.dash));
    assert.ok(heads.includes(p.start) && heads.includes(p.end));
  }
  assert.deepEqual(d.CONNECTOR_PRESETS[0], { id: 'dashed-elbow', label: 'Dashed elbow, dot to arrow', kind: 'elbow', dash: 'dashed', start: 'dot', end: 'arrow', size: 's' });
});

test('every tldraw colour has a readable box band, with a black fallback', () => {
  for (const name of ['black', 'grey', 'light-violet', 'violet', 'blue', 'light-blue', 'yellow', 'orange', 'green', 'light-green', 'light-red', 'red', 'white']) assert.ok(d.BOX_COLORS[name], name);
  assert.equal(d.boxColor('nonsense'), d.BOX_COLORS.black);
});
