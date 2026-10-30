/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const cache = {};
function load(file) {
  if (cache[file]) return cache[file].exports;
  const mod = { exports: {} }; cache[file] = mod;
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => { if (name.startsWith('@/lib/')) return load(`lib/${name.slice(6)}.ts`); return require(name); }, mod, mod.exports);
  return mod.exports;
}
const kit = load('lib/kit.ts');
const opp = load('lib/opportunities.ts');
const id = n => `00000000-0000-4000-8000-00000000000${n}`;

test('kit items read safely, and image sets keep only valid, unique images', () => {
  const item = kit.kitFrom({ id: id(1), title: ' Studio images ', plain_text: '', updated_at: '2026-10-30T00:00:00Z', metadata: { kind: 'image_set', images: [{ mediaId: id(2), title: 'Jar', year: '2025', medium: 'Stoneware', dimensions: '12 × 8 in' }, { mediaId: id(2) }, { mediaId: 'bad' }, { media_id: id(3) }] } });
  assert.equal(item.title, 'Studio images');
  assert.deepEqual(item.images.map(i => i.mediaId), [id(2), id(3)]);
  assert.equal(kit.kitFrom({ id: id(1), metadata: { kind: 'poem' } }), null);
  assert.equal(kit.kitFrom({ id: 'x', metadata: { kind: 'bio_short' } }), null);
  assert.equal(kit.kitFrom({ id: id(4), title: '', metadata: { kind: 'bio_short' } }).title, 'Short bio');
});

test('captions read like a standard image list', () => {
  assert.equal(kit.imageCaption({ title: 'Jar', year: '2025', medium: 'Stoneware, ash glaze', dimensions: '12 × 8 in', credit: '' }), 'Jar, 2025. Stoneware, ash glaze. 12 × 8 in.');
  assert.equal(kit.imageCaption({ title: '', year: '', medium: '', dimensions: '', credit: 'Photo: J. Lee.' }), 'Untitled. Photo: J. Lee.');
});

test('counts and checklist suggestions', () => {
  assert.equal(kit.wordCount('  one two\nthree '), 3);
  assert.equal(kit.charCount(' café '), 4);
  const items = [
    { id: id(1), kind: 'bio_short', title: 'Bio 100', text: '', images: [], updatedAt: '2026-01-01' },
    { id: id(2), kind: 'bio_long', title: 'Bio long', text: '', images: [], updatedAt: '2026-01-01' },
    { id: id(3), kind: 'artist_statement', title: 'General', text: '', images: [], updatedAt: '2026-01-01' },
    { id: id(4), kind: 'artist_statement', title: 'Vessels', text: '', images: [], updatedAt: '2026-06-01' },
    { id: id(5), kind: 'image_set', title: 'Recent work', text: '', images: [], updatedAt: '2026-01-01' },
  ];
  assert.equal(kit.suggestKit('Short bio (100 words)', items).id, id(1));
  assert.equal(kit.suggestKit('Bio', items).id, id(2));
  assert.equal(kit.suggestKit('Artist statement', items).id, id(4)); // newest wins a tie
  assert.equal(kit.suggestKit('10 images', items).id, id(5));
  assert.equal(kit.suggestKit('Application fee', items), null);
  assert.deepEqual(kit.groupKit(items).map(g => g.kind.key), ['bio_short', 'bio_long', 'artist_statement', 'image_set']);
});

test('checklist items keep a valid kit link and drop a bad one', () => {
  const o = opp.opportunityFrom({ id: 'o', title: 'Call', metadata: { kind: 'exhibition', materials: [{ label: 'Bio', done: true, kit: id(1) }, { label: 'Images', done: false, kit: 'nope' }] } });
  assert.deepEqual(o.materials, [{ label: 'Bio', done: true, kit: id(1) }, { label: 'Images', done: false }]);
});

test('the packet is a Word file with named styles and the image list', async () => {
  const { kitDocx } = load('lib/kit-docx.ts');
  const JSZip = require('jszip');
  const buffer = await kitDocx({ title: 'Ox-Bow Residency', meta: ['Ox-Bow School of Art'], items: [
    { id: id(1), kind: 'bio_short', title: 'Bio', text: 'Dustin White makes vessels.\n\nHe teaches.', images: [], updatedAt: '' },
    { id: id(2), kind: 'image_set', title: 'Recent work', text: '', images: [{ mediaId: id(3), title: 'Jar', year: '2025', medium: 'Stoneware', dimensions: '', credit: '' }], updatedAt: '' },
  ] });
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml').async('string');
  const styles = await zip.file('word/styles.xml').async('string');
  assert.ok(xml.includes('Dustin White makes vessels.') && xml.includes('He teaches.'));
  assert.ok(xml.includes('Jar, 2025. Stoneware.'));
  assert.ok(styles.includes('Packet Heading') && styles.includes('Image List'));
});
