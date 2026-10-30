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
  const prompt = tags.imageTagPrompt([{ name: 'sketch', count: 3 }, { name: 'curvilinear form', count: 98 }], 'IMG_2041', 146);
  assert.match(prompt, /File title: IMG_2041\nExisting tags in this library, with how many of its 146 images use each: curvilinear form \(98\), sketch \(3\)/);
  assert.match(prompt, /Already very common, so use only if the image is mainly about it: curvilinear form\n/);
  assert.match(tags.imageTagPrompt([], ''), /none yet/);
  assert.equal(tags.aiTagRecord({ ai_tags: { tags: ['a'] } }).tags[0], 'a');
  assert.equal(tags.aiTagRecord({}), null);
});
test('a pasted command instead of a key is caught, and keys never reach an error message', () => {
  assert.equal(tags.apiKeyProblem(' sk-ant-api03-abcDEF_12-x \n'), '');
  assert.match(tags.apiKeyProblem('curl https://api.anthropic.com/v1/messages --header "x-api-key: sk-ant-abc"'), /isn't just a key/);
  assert.match(tags.apiKeyProblem(''), /isn't set up/);
  const shown = tags.redactSecrets('Headers.append: "Bearer curl https://api.anthropic.com --header "x-api-key: sk-ant-usr-1mgEvUO_dD7-pX" \\');
  assert.doesNotMatch(shown, /sk-ant-usr|1mgEvUO/);
  assert.match(shown, /\[key hidden\]|\[hidden\]/);
});
test('filler tags are dropped and a re-description unlinks the tags it no longer gives', () => {
  assert.deepEqual(tags.parseImageDescription({ caption: 'x', alt_text: '', tags: ['Curvilinear form', 'minimalist', 'tensile membrane', 'design'] }).tags, ['tensile membrane']);
  assert.deepEqual(tags.staleAiTags(['curvilinear form', 'diagram'], ['diagram', 'robotic arm']), ['curvilinear form']);
  assert.deepEqual(tags.staleAiTags(undefined, ['a']), []);
  assert.deepEqual(tags.broadTags([{ name: 'a', count: 40 }, { name: 'b', count: 10 }], 100), ['a']);
  assert.deepEqual(tags.broadTags([{ name: 'a', count: 4 }], 5), []);
  assert.match(tags.undescribedFilter, /ai_tags->>v\.neq\.2/);
});
