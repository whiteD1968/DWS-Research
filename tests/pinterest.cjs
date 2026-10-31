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
const p = load('lib/pinterest.ts');

const feed = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>Tensile structures</title><link>https://www.pinterest.com/duwhite/tensile-structures/</link>
<item><title>Membrane canopy</title><link>https://www.pinterest.com/pin/1234567890/</link><description>&lt;a href="/pin/1234567890/"&gt;&lt;img src="https://i.pinimg.com/236x/ab/cd/ef/abcdef.jpg"&gt;&lt;/a&gt;Steel masts &amp;amp; fabric</description><pubDate>Mon, 26 Oct 2026 14:00:00 GMT</pubDate><guid>https://www.pinterest.com/pin/1234567890/</guid></item>
<item><title><![CDATA[Cable net]]></title><link>https://www.pinterest.com/pin/2222222222/</link><description><![CDATA[<a href="/pin/2222222222/"><img src="https://i.pinimg.com/236x/11/22/33/x.png"></a>Cable net]]></description></item>
<item><title>No image</title><link>https://www.pinterest.com/pin/3333333333/</link><description>just text</description></item>
<item><title>Other host</title><link>https://www.pinterest.com/pin/4444444444/</link><description>&lt;img src="https://evil.example/a.jpg"&gt;</description></item>
</channel></rss>`;

test('board links, profile links, and usernames become feed addresses; other links are refused', () => {
  assert.deepEqual(p.feedFromInput('https://www.pinterest.com/duwhite/tensile-structures/'), { url: 'https://www.pinterest.com/duwhite/tensile-structures.rss', label: 'tensile structures' });
  assert.equal(p.feedFromInput('pinterest.com/duwhite/tensile-structures').url, 'https://www.pinterest.com/duwhite/tensile-structures.rss');
  assert.equal(p.feedFromInput('https://www.pinterest.co.uk/duwhite/glazes/').url, 'https://www.pinterest.com/duwhite/glazes.rss');
  assert.deepEqual(p.feedFromInput('duwhite'), { url: 'https://www.pinterest.com/duwhite/feed.rss', label: 'duwhite · recent pins' });
  assert.equal(p.feedFromInput('https://www.pinterest.com/duwhite/').url, 'https://www.pinterest.com/duwhite/feed.rss');
  assert.equal(p.feedFromInput('https://www.pinterest.com/pin/123/'), null);
  assert.equal(p.feedFromInput('https://evil.example/duwhite/board/'), null);
  assert.equal(p.feedFromInput('https://pinterest.com.evil.example/a/b/'), null);
  assert.equal(p.feedFromInput('https://www.pinterest.com/a/b/c/'), null);
  assert.equal(p.feedFromInput(''), null);
});
test('the feed gives each pin its ID, title, description, and Pinterest image, and skips the rest', () => {
  const result = p.parseFeed(feed);
  assert.equal(result.title, 'Tensile structures');
  assert.deepEqual(result.pins.map(pin => pin.id), ['1234567890', '2222222222']);
  assert.equal(result.pins[0].title, 'Membrane canopy');
  assert.equal(result.pins[0].description, 'Steel masts & fabric');
  assert.equal(result.pins[0].image, 'https://i.pinimg.com/236x/ab/cd/ef/abcdef.jpg');
  assert.equal(result.pins[0].savedAt, '2026-10-26T14:00:00.000Z');
  assert.equal(result.pins[1].image, 'https://i.pinimg.com/236x/11/22/33/x.png');
  assert.ok(result.items > result.pins.length);
});
test('an empty feed has no entries, and a media tag can carry the image', () => {
  assert.deepEqual(p.parseFeed('<rss><channel><title>Empty</title></channel></rss>'), { title: 'Empty', pins: [], items: 0 });
  const media = p.parseFeed('<rss><channel><item><title>T</title><guid>https://www.pinterest.com/pin/5555555555/</guid><media:content url="http://i.pinimg.com/236x/aa/bb/cc/m.jpg" /></item></channel></rss>');
  assert.deepEqual(media.pins.map(pin => [pin.id, pin.image]), [['5555555555', 'https://i.pinimg.com/236x/aa/bb/cc/m.jpg']]);
});
test('the original image is tried before larger and feed sizes', () => {
  assert.deepEqual(p.imageCandidates('https://i.pinimg.com/236x/ab/cd/ef/abcdef.jpg'), ['https://i.pinimg.com/originals/ab/cd/ef/abcdef.jpg', 'https://i.pinimg.com/736x/ab/cd/ef/abcdef.jpg', 'https://i.pinimg.com/236x/ab/cd/ef/abcdef.jpg']);
});
test('a pin keeps its link and board, and a title that only repeats the description becomes a file name for Describe', () => {
  const [first, second] = p.parseFeed(feed).pins;
  const record = p.pinRecord(first, { url: 'u', label: 'Tensile structures' });
  assert.equal(record.title, 'Membrane canopy');
  assert.equal(record.metadata.pinterest.url, 'https://www.pinterest.com/pin/1234567890/');
  assert.equal(record.metadata.pinterest.board, 'Tensile structures');
  assert.equal(p.pinRecord(second, { url: 'u', label: 'x' }).title, 'pinterest-2222222222');
  assert.deepEqual(p.feedsFrom({ feeds: [{ url: 'a', label: 'b' }, { nope: 1 }] }), [{ url: 'a', label: 'b' }]);
  assert.equal(p.extensionFor('image/tiff'), '');
});
