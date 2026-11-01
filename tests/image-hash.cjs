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
const h = load('lib/image-hash.ts');

const gradient = Array.from({ length: 72 }, (_, i) => 255 - (i % 9) * 20);
test('a fingerprint is 16 hex characters and reads brightness steps left to right', () => {
  assert.equal(h.differenceHash(gradient), 'ffffffffffffffff');
  assert.equal(h.differenceHash(gradient.map(v => 255 - v)), '0000000000000000');
  assert.throws(() => h.differenceHash([1, 2, 3]));
});
test('distance counts differing bits', () => {
  assert.equal(h.hashDistance('0000000000000000', '0000000000000000'), 0);
  assert.equal(h.hashDistance('0000000000000000', '000000000000000f'), 4);
  assert.equal(h.hashDistance('0000000000000000', 'ffffffffffffffff'), 64);
  assert.equal(h.hashDistance('00', '0000000000000000'), 64);
});
test('near matches group together, far ones and blank images stay out, and dismissed pairs are kept apart', () => {
  const hashes = { a: 'a5a5a5a5a5a5a5a5', b: 'a5a5a5a5a5a5a5a4', c: 'a5a5a5a5a5a5a5b6', d: '5a5a5a5a5a5a5a5a', e: '0000000000000000', f: '0000000000000000', g: 'nope' };
  assert.deepEqual(h.duplicateGroups(hashes), [['a', 'b', 'c']]);
  assert.deepEqual(h.duplicateGroups({ a: 'a5a5a5a5a5a5a5a5', z: 'a5a5a5a5a5a55a5a' }), []);
  assert.deepEqual(h.duplicateGroups(hashes, 1), [['a', 'b']]);
  assert.deepEqual(h.duplicateGroups({ a: hashes.a, b: hashes.b }, 5, [h.pairKey('b', 'a')]), []);
});
test('the kept copy is the largest, then the better tagged or named, then the oldest', () => {
  assert.equal(h.pickKeeper([{ id: 'small', width: 236, height: 300 }, { id: 'big', width: 1200, height: 1500 }]), 'big');
  assert.equal(h.pickKeeper([{ id: 'a', width: 10, height: 10, tags: 1 }, { id: 'b', width: 10, height: 10, tags: 4 }]), 'b');
  assert.equal(h.pickKeeper([{ id: 'new', createdAt: '2026-10-31' }, { id: 'old', createdAt: '2026-01-01' }]), 'old');
  assert.equal(h.pickKeeper([]), '');
});
