/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, mocks = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => { if (name in mocks) return mocks[name]; throw new Error(`Unexpected import ${name}`); }, mod, mod.exports);
  return mod.exports;
}
const cv = load('lib/cv.ts');
const entry = (fields) => ({ title: '', venue: '', location: '', date: '2026', end_date: '', people: '', url: '', ...fields });

test('CV dates are a year with an optional month', () => {
  assert.equal(cv.parseCvDate('2026'), '2026');
  assert.equal(cv.parseCvDate('2026', '3'), '2026-03');
  assert.equal(cv.parseCvDate('2026', ''), '2026');
  assert.equal(cv.parseCvDate('26'), null);
  assert.equal(cv.parseCvDate('2026', '13'), null);
  assert.equal(cv.cvYears({ date: '2024-09', end_date: '2026' }), '2024–2026');
  assert.equal(cv.cvYears({ date: '2026-05', end_date: '2026' }), '2026');
});
test('citations follow the usual form for each kind of entry', () => {
  assert.equal(cv.cvCitation(entry({ category: 'group_exhibition', title: 'Ground Truth', venue: 'Clay Art Center', location: 'Port Chester, NY', people: 'Jane Doe' })), 'Ground Truth, Clay Art Center, Port Chester, NY, curated by Jane Doe');
  assert.equal(cv.cvCitation(entry({ category: 'publication', title: 'Ash and Memory', venue: 'Ceramics Monthly', people: 'White, D.' })), 'White, D. “Ash and Memory,” Ceramics Monthly.');
  assert.equal(cv.cvCitation(entry({ category: 'presentation', title: 'Kiln Records', venue: 'NCECA', location: 'Richmond, VA' })), '“Kiln Records,” NCECA, Richmond, VA.');
  assert.equal(cv.cvCitation(entry({ category: 'publication', title: 'Field Notes.' })), '“Field Notes.”');
  assert.equal(cv.cvCitation(entry({ category: 'residency', title: 'Long-term resident', venue: 'Archie Bray', location: 'Helena, MT' })), 'Long-term resident, Archie Bray, Helena, MT');
  assert.equal(cv.cvCitation(entry({ category: 'teaching', title: 'Ceramics II', venue: 'State University', people: 'A. Smith' })), 'Ceramics II, State University (with A. Smith)');
});
test('entries group in CV order, newest first', () => {
  const groups = cv.groupCv([
    entry({ category: 'teaching', title: 'B', date: '2024' }),
    entry({ category: 'solo_exhibition', title: 'Old', date: '2021' }),
    entry({ category: 'solo_exhibition', title: 'New', date: '2026-02' }),
  ]);
  assert.deepEqual(groups.map(group => group.category.key), ['solo_exhibition', 'teaching']);
  assert.deepEqual(groups[0].entries.map(item => item.title), ['New', 'Old']);
  assert.equal(cv.cvFields({ title: 'X', metadata: { category: 'nope' } }), null);
  assert.equal(cv.cvFields({ title: ' X ', metadata: { category: 'award', date: '2025' } }).title, 'X');
});
test('the Word export carries named paragraph styles for InDesign', async () => {
  const docx = load('lib/cv-docx.ts', { docx: require('docx'), '@/lib/cv': cv });
  const buffer = await docx.cvDocx([entry({ category: 'award', title: 'Artist Fellowship', venue: 'State Arts Council', date: '2025', url: 'https://example.org' })]);
  const zip = await require('jszip').loadAsync(buffer);
  const styles = await zip.file('word/styles.xml').async('string');
  const body = await zip.file('word/document.xml').async('string');
  for (const name of ['CV Section', 'CV Entry', 'CV Link']) assert.ok(styles.includes(`w:val="${name}"`), name);
  assert.ok(body.includes('Awards &amp; grants'));
  assert.ok(body.includes('Artist Fellowship, State Arts Council'));
  assert.ok(body.includes('<w:tab/>'));
});
