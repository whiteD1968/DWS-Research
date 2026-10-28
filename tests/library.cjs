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
const library = load('lib/library.ts');
test('library search patterns drop characters that would break Supabase or() filters', () => {
  assert.equal(library.libraryPattern('  steel, glass (1950) 100%_  '), '%steel  glass  1950  100%');
  assert.equal(library.libraryPattern(' ,() '), '');
});
test('library views fall back to everything for unknown values', () => {
  assert.equal(library.parseLibraryView('notes'), 'notes');
  assert.equal(library.parseLibraryView('media'), 'all');
  assert.equal(library.parseLibraryView(undefined), 'all');
});
test('library entries merge newest first across kinds and page without repeats', () => {
  const groups = [
    [library.mediaEntry({ id: 'm1', media_type: 'image', title: 'Kiln', updated_at: '2026-10-03' }), library.mediaEntry({ id: 'm2', media_type: 'document', mime_type: 'application/pdf', original_filename: 'brief.pdf', updated_at: '2026-10-01' })],
    [library.noteEntry({ id: 'n1', plain_text: 'idea', updated_at: '2026-10-04' })],
    [library.referenceEntry({ id: 'r1', title: 'Casa', reference_type: 'case_study', creator: 'Barragán', updated_at: '2026-10-02' })],
  ];
  assert.deepEqual(library.mergeEntries(groups, 0, 2).map(e => e.id), ['n1', 'm1']);
  assert.deepEqual(library.mergeEntries(groups, 2, 2).map(e => e.id), ['r1', 'm2']);
  const [doc] = library.mergeEntries(groups, 3, 1);
  assert.equal(doc.kind, 'documents'); assert.equal(doc.label, 'PDF'); assert.equal(doc.title, 'brief.pdf');
  assert.equal(library.mergeEntries(groups, 2, 1)[0].label, 'case study · Barragán');
});
