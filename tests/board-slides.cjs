/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const sharp = require('sharp');
const mod = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync('lib/boards/slides.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(() => { throw new Error('no imports'); }, mod, mod.exports);
const s = mod.exports;
const frame = (id, x, y, meta = {}, name = id) => ({ id, x, y, name, meta });

test('slides follow saved order, then reading order', () => {
  const slides = s.orderSlides([frame('c', 0, 900), frame('b', 1400, 0), frame('a', 0, 10), frame('z', 5000, 5000, { slideIndex: 0 })]);
  assert.deepEqual(slides.map(x => x.id), ['z', 'a', 'b', 'c']);
  assert.deepEqual(slides.map(x => x.index), [0, 1, 2, 3]);
});

test('theme zones are hidden by default but can be shown', () => {
  assert.equal(s.slideHidden({ boardZone: 'theme' }), true);
  assert.equal(s.slideHidden({ recordKey: 'theme:1' }), true);
  assert.equal(s.slideHidden({ boardZone: 'theme', slideHidden: false }), false);
  assert.equal(s.slideHidden({}), false);
  const [slide] = s.orderSlides([frame('a', 0, 0, { slideNotes: 'Say hello' }, '')]);
  assert.equal(slide.notes, 'Say hello');
  assert.equal(slide.name, 'Slide 1');
});

test('moving a slide keeps every other slide in place', () => {
  assert.deepEqual(s.moveSlide(['a', 'b', 'c', 'd'], 'd', 1), ['a', 'd', 'b', 'c']);
  assert.deepEqual(s.moveSlide(['a', 'b', 'c'], 'a', 99), ['b', 'c', 'a']);
  assert.equal(s.slideFileName(3, 'Intro / site', 'svg'), '03 - Intro - site.svg');
});

test('deck PDF opens with one correctly sized page per slide', async () => {
  const jpeg = async (w, h) => new Uint8Array(await sharp({ create: { width: w, height: h, channels: 3, background: '#c33' } }).jpeg().toBuffer());
  const a = await jpeg(320, 180), b = await jpeg(200, 300);
  assert.deepEqual(s.jpegSize(a), { width: 320, height: 180 });
  const pdf = s.buildPdf([{ jpeg: a, pageWidth: 960, pageHeight: 540 }, { jpeg: b, pageWidth: 612, pageHeight: 792 }]);
  const pdfjs = await import(path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.mjs'));
  const doc = await pdfjs.getDocument({ data: pdf, isEvalSupported: false, useSystemFonts: false }).promise;
  assert.equal(doc.numPages, 2);
  const p2 = await doc.getPage(2);
  assert.deepEqual(p2.view, [0, 0, 612, 792]);
  const ops = await p2.getOperatorList();
  assert.ok(ops.fnArray.includes(pdfjs.OPS.paintImageXObject));
});

test('zip holds each file intact', () => {
  const enc = new TextEncoder();
  const files = [{ name: '01 - Intro.svg', data: enc.encode('<svg/>') }, { name: '02 - Site.svg', data: enc.encode('<svg>2</svg>') }];
  const zip = s.buildZip(files);
  const view = new DataView(zip.buffer);
  const end = zip.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), 2);
  let at = view.getUint32(end + 16, true);
  for (const file of files) {
    assert.equal(view.getUint32(at, true), 0x02014b50);
    const local = view.getUint32(at + 42, true), nameLength = view.getUint16(at + 28, true);
    assert.equal(new TextDecoder().decode(zip.slice(at + 46, at + 46 + nameLength)), file.name);
    assert.equal(view.getUint32(at + 16, true), s.crc32(file.data));
    const start = local + 30 + view.getUint16(local + 26, true);
    assert.deepEqual(zip.slice(start, start + file.data.length), file.data);
    at += 46 + nameLength;
  }
  assert.equal(s.crc32(enc.encode('123456789')), 0xcbf43926);
});
