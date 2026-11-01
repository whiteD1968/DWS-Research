/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync('lib/boards/layout-tools.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(() => { throw new Error('no imports'); }, mod, mod.exports);
const { FRAME_PRESETS, exportFileName } = mod.exports;

test('frame presets have unique labels and the right proportions', () => {
  assert.equal(new Set(FRAME_PRESETS.map(p => p.label)).size, FRAME_PRESETS.length);
  const ratio = label => { const p = FRAME_PRESETS.find(f => f.label === label); return p.w / p.h; };
  assert.ok(Math.abs(ratio('Slide 16:9') - 16 / 9) < 0.001);
  assert.ok(Math.abs(ratio('Letter portrait') - 8.5 / 11) < 0.001);
  assert.ok(Math.abs(ratio('A4 portrait') - 210 / 297) < 0.002);
  assert.ok(Math.abs(ratio('Poster 24×36') - 24 / 36) < 0.001);
  for (const p of FRAME_PRESETS) assert.ok(Number.isInteger(p.w) && Number.isInteger(p.h) && p.w > 0 && p.h > 0);
});

test('export names are readable and filesystem safe', () => {
  assert.equal(exportFileName('Thesis wall', 'board'), 'Thesis wall');
  assert.equal(exportFileName('Thesis / wall', 'frame', 'Slide 16:9'), 'Thesis - wall - Slide 16-9');
  assert.equal(exportFileName('  ', 'selection'), 'Board - selection');
  assert.equal(exportFileName('Wall', 'frame', ''), 'Wall - Frame');
});
