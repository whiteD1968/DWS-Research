/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync('lib/boards/card-svg.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(() => { throw new Error('no imports'); }, mod, mod.exports);
const { wrapText, layoutCard } = mod.exports;
const measure = (text, style) => text.length * style.size * 0.5; // fixed-width stand-in
const style = { family: 'x', size: 10, weight: 400, letterSpacing: 0 };

test('wraps words within the width and clips with an ellipsis', () => {
  assert.deepEqual(wrapText('one two three four', style, 30, 5, measure), ['one', 'two', 'three', 'four']);
  assert.deepEqual(wrapText('one two three four', style, 75, 5, measure), ['one two three', 'four']);
  const clipped = wrapText('one two three four five six', style, 30, 2, measure);
  assert.equal(clipped.length, 2);
  assert.ok(clipped[1].endsWith('…'));
  for (const line of clipped) assert.ok(measure(line, style) <= 30);
});

test('breaks long words and uppercases labels', () => {
  const lines = wrapText('Supercalifragilistic', style, 40, 9, measure);
  assert.ok(lines.length > 1 && lines.every(l => measure(l, style) <= 40));
  assert.equal(lines.join(''), 'Supercalifragilistic');
  assert.deepEqual(wrapText('theme', { ...style, uppercase: true }, 100, 1, measure), ['THEME']);
});

test('image cards put the image on top and keep the caption to half the card', () => {
  const card = layoutCard({ type: 'media', label: 'media', title: 'A very long title that keeps going and going and going', image: 'data:x' }, 280, 320, measure);
  assert.deepEqual([card.image.x, card.image.y, card.image.w], [0, 0, 280]);
  assert.ok(card.image.h >= 160);
  for (const t of card.texts) {
    assert.ok(t.y >= card.image.h);
    assert.ok(t.y + t.lines.length * t.lineHeight <= 320 + 0.01);
  }
});

test('text cards stay inside the card and follow type styling', () => {
  const note = layoutCard({ type: 'note', label: 'note', title: 'Field note', body: 'word '.repeat(200) }, 280, 200, measure);
  assert.equal(note.background, '#fcfbf6');
  const last = note.texts[note.texts.length - 1];
  assert.ok(last.y + (last.lines.length - 1) * last.lineHeight < 200); // the last line may be cut by the card edge, as on the board
  assert.ok(last.y + last.lines.length * last.lineHeight <= 200 + last.lineHeight * 0.6);
  const theme = layoutCard({ type: 'theme', label: 'Theme / linked', title: 'Light', compact: false }, 300, 64, measure);
  assert.equal(theme.background, undefined);
  assert.equal(theme.border.topOnly, true);
  const compact = layoutCard({ type: 'reference', label: 'reference', title: 'Short', byline: 'Someone', compact: true }, 200, 104, measure);
  assert.equal(compact.texts.length, 1); // no label or byline on compact cards
});
