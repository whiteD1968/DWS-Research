/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
function load(file) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => { throw new Error(`Unexpected import ${name}`); }, mod, mod.exports);
  return mod.exports;
}
const links = load('lib/weblinks.ts');
const zip = load('lib/zip.ts');
const ext = load('lib/chrome-extension.ts');

test('addresses lose tracking parameters and unsafe schemes are refused', () => {
  assert.equal(links.cleanUrl('https://www.dezeen.com/2026/a/?utm_source=ig&utm_medium=x&id=4'), 'https://www.dezeen.com/2026/a/?id=4');
  assert.equal(links.cleanUrl('archdaily.com/123'), 'https://archdaily.com/123');
  assert.equal(links.cleanUrl('javascript:alert(1)'), null);
  assert.equal(links.cleanUrl('chrome://extensions'), null);
  assert.equal(links.cleanUrl('https://user:pw@example.com/x'), 'https://example.com/x');
  assert.equal(links.cleanUrl('https://example.com/page).'), 'https://example.com/page');
});

test('the same page matches across www, trailing slashes, #sections and parameter order', () => {
  assert.equal(links.linkKey('https://www.a.com/x/?b=2&a=1#top'), links.linkKey('http://a.com/x?a=1&b=2'));
  assert.notEqual(links.linkKey('https://a.com/x?id=1'), links.linkKey('https://a.com/x?id=2'));
});

test('pasted lists in every common shape come back as links with titles', () => {
  const text = [
    'https://www.archdaily.com/1001/pavilion',
    'Kiln building guide - https://ceramicartsnetwork.org/kiln',
    '[Robotic clay printing](https://example.com/robot)',
    'https://onetab.example/page | OneTab title',
    'Line title above',
    'https://example.org/below',
    'https://www.archdaily.com/1001/pavilion/?utm_source=x',
    'not a link at all',
  ].join('\n');
  const found = links.parseLinkList(text);
  assert.deepEqual(found.map(item => item.url), ['https://www.archdaily.com/1001/pavilion', 'https://ceramicartsnetwork.org/kiln', 'https://example.com/robot', 'https://onetab.example/page', 'https://example.org/below']);
  assert.equal(found[1].title, 'Kiln building guide');
  assert.equal(found[2].title, 'Robotic clay printing');
  assert.equal(found[3].title, 'OneTab title');
  assert.equal(found[4].title, 'Line title above');
});

test('a Chrome bookmarks export is read with its titles', () => {
  const html = '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><A HREF="https://www.dezeen.com/x" ADD_DATE="1">Dezeen &amp; friends</A><DT><A HREF="javascript:void(0)">Bad</A><DT><A HREF="https://youtu.be/abc">Video</A></DL>';
  const found = links.parseLinkList(html);
  assert.deepEqual(found, [{ url: 'https://www.dezeen.com/x', title: 'Dezeen & friends' }, { url: 'https://youtu.be/abc', title: 'Video' }]);
});

test('tabs handed over by the extension survive the trip, including accents and emoji', () => {
  const encoded = links.encodeImport([{ u: 'https://a.com/x?utm_source=1', t: 'Café ✨ pavilion' }, { u: 'chrome://newtab' }, { u: 'https://a.com/x' }]);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(links.decodeImport(encoded), [{ url: 'https://a.com/x', title: 'Café ✨ pavilion' }]);
  assert.deepEqual(links.decodeImport('%%%not base64'), []);
  // The extension's own encoder (plain JS in the popup) must agree with the page's decoder.
  const files = ext.chromeExtensionFiles('https://dws.example');
  const popup = files.find(file => file.name.endsWith('popup.js')).data;
  const encode = new Function(`${popup.match(/function encode[\s\S]*?\n}/)[0]}; return encode;`)();
  assert.deepEqual(links.decodeImport(encode([{ u: 'https://b.org/é', t: 'Ünïcode' }])), [{ url: 'https://b.org/%C3%A9', title: 'Ünïcode' }]);
});

test('automatic tags come from the website and words in the title', () => {
  assert.deepEqual(links.autoTags('https://www.youtube.com/watch?v=1', 'CNC router tutorial for plywood'), ['Video', 'Fabrication', 'Materials', 'Tutorials']);
  assert.ok(links.autoTags('https://www.archdaily.com/1/x', 'Timber pavilion').includes('Architecture'));
  assert.ok(links.autoTags('https://callforentry.org/festivals_unique_info.php?ID=1', 'Public art call for artists 2027').includes('Opportunities'));
  assert.ok(links.autoTags('https://callforentry.org/x', 'Public art call for artists').includes('Public art'));
  assert.ok(links.autoTags('https://a.com/paper.pdf', '').includes('PDF'));
  assert.deepEqual(links.autoTags('https://www.amazon.com/dp/1', 'Ceramics handbook (Hardcover)'), ['Shopping', 'Books', 'Ceramics']);
  assert.deepEqual(links.autoTags('https://myschool.edu/about', ''), ['University']);
  assert.deepEqual(links.autoTags('https://example.com', 'Nothing in particular'), []);
  assert.ok(links.autoTags('https://example.com', 'Assistant Professor of Architecture, search committee').includes('Jobs'));
});

test('tags are tidied, deduplicated without regard to case, and capped', () => {
  assert.deepEqual(links.parseTags([' #Kiln ', 'kiln', 'Robot  arm', '', 3]), ['Kiln', 'Robot arm']);
  assert.deepEqual(links.parseTags('a, b ,c'), ['a', 'b', 'c']);
  assert.equal(links.parseTags(Array.from({ length: 30 }, (_, i) => `t${i}`)).length, links.maxTags);
});

test('saved links read safely from note metadata', () => {
  const link = links.weblinkFrom({ id: '1', title: '', plain_text: 'why', metadata: { url: 'https://www.dezeen.com/x', tags: ['Design', 'design'], frame: 'nope', image: 'http://insecure/x.png' }, created_at: '2026-11-09T00:00:00Z' });
  assert.equal(link.title, 'dezeen.com');
  assert.equal(link.domain, 'dezeen.com');
  assert.deepEqual(link.tags, ['Design']);
  assert.equal(link.frame, 'unknown');
  assert.equal(link.image, '');
  assert.equal(link.savedAt, '2026-11-09T00:00:00Z');
  assert.equal(links.weblinkFrom({ metadata: {} }), null);
  assert.equal(links.matchesLink(link, 'dezeen design'), true);
  assert.equal(links.matchesLink(link, 'kiln'), false);
});

test('players and documents use their embeddable address', () => {
  assert.equal(links.embedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(links.embedUrl('https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(links.embedUrl('https://vimeo.com/123456'), 'https://player.vimeo.com/video/123456');
  assert.equal(links.embedUrl('https://docs.google.com/document/d/abc_1/edit'), 'https://docs.google.com/document/d/abc_1/preview');
  assert.equal(links.embedUrl('https://drive.google.com/file/d/xyz/view'), 'https://drive.google.com/file/d/xyz/preview');
  assert.equal(links.embedUrl('https://www.dezeen.com/x'), null);
});

test('frame blocking is read from X-Frame-Options and CSP frame-ancestors', () => {
  const h = obj => ({ get: name => obj[name] ?? null });
  assert.equal(links.frameStatusFromHeaders(h({})), 'ok');
  assert.equal(links.frameStatusFromHeaders(h({ 'x-frame-options': 'SAMEORIGIN' })), 'blocked');
  assert.equal(links.frameStatusFromHeaders(h({ 'x-frame-options': 'DENY' })), 'blocked');
  assert.equal(links.frameStatusFromHeaders(h({ 'content-security-policy': "default-src 'self'; frame-ancestors 'self'" })), 'blocked');
  assert.equal(links.frameStatusFromHeaders(h({ 'content-security-policy': 'frame-ancestors *' })), 'ok');
  assert.equal(links.frameStatusFromHeaders(h({ 'content-security-policy': 'frame-ancestors https://*.vercel.app' }), 'https://dws.vercel.app'), 'ok');
  assert.equal(links.frameStatusFromHeaders(h({ 'content-security-policy': "script-src 'self'" })), 'ok');
});

test('page details are read from the head of the page', () => {
  const html = '<html><head><title> Plain &amp; title </title><meta property="og:title" content="OG Title"><meta content="A short summary." name="description"><meta property="og:image" content="/cover.jpg"><meta property="og:site_name" content="Studio"></head></html>';
  assert.deepEqual(links.pageInfoFromHtml(html, 'https://studio.example/a/b'), { title: 'OG Title', description: 'A short summary.', siteName: 'Studio', image: 'https://studio.example/cover.jpg' });
  assert.equal(links.pageInfoFromHtml('<title>Only &#39;this&#39;</title>', 'https://a.com').title, "Only 'this'");
});

test('server page fetches stay off private networks', () => {
  for (const host of ['localhost', '127.0.0.1', '10.1.2.3', '192.168.0.4', '172.20.1.1', '169.254.169.254', '::1', 'fd00::1', 'printer.local', '[::1]']) assert.equal(links.isPrivateHost(host), true, host);
  for (const host of ['dezeen.com', '8.8.8.8', '172.32.0.1', '2606:4700::1']) assert.equal(links.isPrivateHost(host), false, host);
});

test('tag counts sort the busiest first', () => {
  const list = [{ tags: ['A', 'B'] }, { tags: ['B'] }, { tags: [] }];
  assert.deepEqual(links.tagCounts(list), [{ name: 'B', count: 2 }, { name: 'A', count: 1 }]);
});

test('the Chrome extension zips into a valid folder pointed at this site', () => {
  const files = ext.chromeExtensionFiles('https://dws.example', [{ size: 16, data: new Uint8Array([1, 2, 3]) }]);
  const manifest = JSON.parse(files.find(file => file.name.endsWith('manifest.json')).data);
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['tabs']);
  assert.equal(manifest.action.default_icon['16'], 'icon-16.png');
  assert.ok(files.find(file => file.name.endsWith('popup.js')).data.startsWith('const site = "https://dws.example";'));
  const bytes = zip.zipFiles(files);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dws-zip-'));
  const file = path.join(dir, 'x.zip'); fs.writeFileSync(file, bytes);
  const listing = execFileSync('python3', ['-c', 'import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print("\\n".join(z.namelist()))', file]).toString().trim().split('\n');
  assert.deepEqual(listing, files.map(f => f.name));
  assert.equal(zip.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});
