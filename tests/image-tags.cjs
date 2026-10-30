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
const tags = load('lib/image-tags.ts');

test('tags are lowercased, trimmed, de-duplicated, and capped', () => {
  const result = tags.parseImageDescription(JSON.stringify({ caption: '  A stoneware jar  on a shelf. ', alt_text: 'Image of a stoneware jar', tags: ['Ceramics', 'ceramics', '#Glaze Test', 'stoneware!', 'a very long tag with many words', '', 'jar', 'shelf', 'studio', 'extra'] }));
  assert.equal(result.caption, 'A stoneware jar on a shelf.');
  assert.equal(result.altText, 'A stoneware jar');
  assert.deepEqual(result.tags, ['ceramics', 'glaze test', 'stoneware', 'jar', 'shelf', 'studio']);
});
test('existing tag spelling wins', () => {
  assert.equal(tags.normalizeTag('wheel-thrown', ['Wheel-Thrown']), 'Wheel-Thrown');
  assert.deepEqual(tags.parseImageDescription({ caption: 'x', alt_text: '', tags: ['SKETCH'] }, ['Sketch']).tags, ['Sketch']);
});
test('unreadable replies are rejected', () => {
  assert.equal(tags.parseImageDescription('not json'), null);
  assert.equal(tags.parseImageDescription({ caption: '', alt_text: '', tags: [] }), null);
});
test('hand-written captions are never replaced', () => {
  assert.equal(tags.nextText('', undefined, 'New'), 'New');
  assert.equal(tags.nextText('Old AI caption', 'Old AI caption', 'New'), 'New');
  assert.equal(tags.nextText('My own words', 'Old AI caption', 'New'), null);
  assert.equal(tags.nextText('', undefined, ''), null);
});
test('the prompt lists existing tags', () => {
  assert.match(tags.imageTagPrompt(['ceramics', 'sketch'], 'IMG_2041'), /File title: IMG_2041\nExisting tags in this library: ceramics, sketch/);
  assert.match(tags.imageTagPrompt([], ''), /none yet/);
  assert.equal(tags.aiTagRecord({ ai_tags: { tags: ['a'] } }).tags[0], 'a');
  assert.equal(tags.aiTagRecord({}), null);
});
