/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => { throw new Error(`Unexpected import ${name}`); }, mod, mod.exports);
  return mod.exports;
}
const { similarImages, captionWords } = load('lib/similar.ts');

const images = [
  { id: 'a', tags: ['tensile membrane', 'pavilion', 'render'], text: 'A white tensile membrane pavilion stretched over steel masts.' },
  { id: 'b', tags: ['tensile membrane', 'pavilion', 'installation view'], text: 'Tensile fabric canopy over a courtyard.' },
  { id: 'c', tags: ['glaze test', 'stoneware'], text: 'Rows of stoneware glaze test tiles on a shelf.' },
  { id: 'd', tags: ['render'], text: 'A render of a concrete stair.' },
  { id: 'e', tags: ['stoneware', 'jar'], text: 'A wheel-thrown stoneware jar.' },
];

test('caption words drop stopwords and fold plurals', () => {
  assert.deepEqual(captionWords('Rows of the glaze tiles, 12 tiles'), ['row', 'glaze', 'tile']);
  assert.deepEqual(captionWords('Wheel-thrown glass'), ['wheel-thrown', 'glass']);
});
test('the closest image comes first and the target is left out', () => {
  const result = similarImages(['a'], images);
  assert.equal(result[0].id, 'b');
  assert.ok(!result.some(match => match.id === 'a'));
  assert.deepEqual(result[0].shared.sort(), ['pavilion', 'tensile membrane']);
  assert.ok(!result.some(match => match.id === 'c'));
});
test('several targets combine and unrelated images stay out', () => {
  const result = similarImages(['c'], images);
  assert.deepEqual(result.map(match => match.id), ['e']);
  assert.deepEqual(similarImages(['a', 'b'], images).map(match => match.id)[0], 'd');
});
test('an image with nothing to compare finds nothing', () => {
  assert.deepEqual(similarImages(['x'], [...images, { id: 'x', tags: [], text: '' }]), []);
  assert.equal(similarImages(['a'], images, 1).length, 1);
});
