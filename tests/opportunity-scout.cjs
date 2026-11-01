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
const scout = load('lib/opportunity-scout.ts', { '@/lib/opportunities': load('lib/opportunities.ts') });

test('saved searches are trimmed, de-duplicated, and capped', () => {
  assert.deepEqual(scout.parseSearches(' open  call \n\nopen call\nresidency '), ['open call', 'residency']);
  assert.equal(scout.parseSearches('a\nb\nc\nd\ne\nf\ng\nh\ni').length, 8);
});
test('the scout runs about once a day', () => {
  const now = new Date('2026-10-29T15:00:00Z');
  assert.equal(scout.scoutDue(null, now), true);
  assert.equal(scout.scoutDue('2026-10-29T06:00:00Z', now), false);
  assert.equal(scout.scoutDue('2026-10-28T15:00:00Z', now), true);
});
test('the same page is recognised however it is linked', () => {
  assert.equal(scout.leadKey('https://www.Example.org/calls/2027/?utm_source=x#apply'), scout.leadKey('https://example.org/calls/2027'));
  assert.notEqual(scout.leadKey('https://example.org/calls?id=1'), scout.leadKey('https://example.org/calls?id=2'));
  assert.equal(scout.leadKey('not a url'), '');
});
test('deadlines are picked out of result text, and closed calls are flagged', () => {
  assert.deepEqual(scout.guessDeadline('Open call. Deadline: January 15, 2027. $35 fee', '2026-10-29'), { deadline: '2027-01-15', past: false });
  assert.deepEqual(scout.guessDeadline('Apply by Mar 3', '2026-10-29'), { deadline: '2027-03-03', past: false });
  assert.deepEqual(scout.guessDeadline('Applications due 12/1/2026', '2026-10-29'), { deadline: '2026-12-01', past: false });
  assert.deepEqual(scout.guessDeadline('Deadline was September 1, 2026', '2026-10-29'), { deadline: '', past: true });
  assert.deepEqual(scout.guessDeadline('Exhibition runs November 4, 2026', '2026-10-29'), { deadline: '', past: false });
});
test('the kind of opportunity is guessed from the wording', () => {
  assert.equal(scout.guessKind('Summer Artist Residency 2027'), 'residency');
  assert.equal(scout.guessKind('Individual Artist Fellowship'), 'fellowship');
  assert.equal(scout.guessKind('Call for Entries: national juried exhibition'), 'exhibition');
  assert.equal(scout.guessKind('RFQ: public art commission for transit center'), 'commission');
  assert.equal(scout.guessKind('Assistant Professor of Ceramics'), 'job');
  assert.equal(scout.guessKind('Something else'), 'other');
});
test('day-first dates and recently passed yearless dates are read correctly', () => {
  assert.deepEqual(scout.guessDeadline('Apply by 18 October 2026', '2026-10-30'), { deadline: '', past: true });
  assert.deepEqual(scout.guessDeadline('Deadline: 3 December 2026', '2026-10-30'), { deadline: '2026-12-03', past: false });
  assert.deepEqual(scout.guessDeadline('Open calls ending soon. Deadline Oct 20', '2026-10-30'), { deadline: '', past: true });
  assert.deepEqual(scout.guessDeadline('Apply by Mar 3', '2026-10-30'), { deadline: '2027-03-03', past: false });
});
test('directory and roundup pages are recognised', () => {
  assert.equal(scout.looksLikeListing('All Open Calls for Artists (Full Directory) | Arthead'), true);
  assert.equal(scout.looksLikeListing('Open calls ending soon - ACAVA'), true);
  assert.equal(scout.looksLikeListing('25 Artist Residencies to Apply for This Winter'), false);
  assert.equal(scout.looksLikeListing('Top residencies for sculptors'), true);
  assert.equal(scout.looksLikeListing('Summer Artist Residency 2027 at Ferme Saint Siméon'), false);
});
test('a trailing site name is trimmed from titles', () => {
  assert.equal(scout.cleanTitle('Entries open for Artist Residency at Ferme Saint Siméon in France - fundsforNGOs', 'fundsforNGOs'), 'Entries open for Artist Residency at Ferme Saint Siméon in France');
  assert.equal(scout.cleanTitle('All Open Calls for Artists | Arthead', 'Arthead'), 'All Open Calls for Artists');
  assert.equal(scout.cleanTitle('Funding for Artists - DCLA', 'City of New York'), 'Funding for Artists - DCLA');
  assert.equal(scout.cleanTitle('Call to Artists - Apply by Dec 1, 2026 · OpenCall', 'OpenCall'), 'Call to Artists - Apply by Dec 1, 2026');
});

test('the first generic searches move to the studio searches, and edited ones are kept', () => {
  assert.deepEqual(scout.currentSearches(['artist open call deadline', 'artist residency application deadline', 'artist grant application deadline', 'juried exhibition call for artists']), scout.defaultSearches);
  assert.deepEqual(scout.currentSearches(['public art Miami']), ['public art Miami']);
  assert.deepEqual(scout.currentSearches(undefined), scout.defaultSearches);
  assert.ok(scout.defaultSearches.length <= scout.maxSearches);
});
test('student calls are skipped by whole phrase, and saved skip words replace the defaults', () => {
  const skip = scout.currentSkip(undefined);
  assert.ok(scout.shouldSkip('2026 Student Design Competition: furniture', skip));
  assert.ok(scout.shouldSkip('Open call for high school artists', skip));
  assert.ok(!scout.shouldSkip('Public art RFQ for Fort Lauderdale; studio artists welcome', skip));
  assert.ok(!scout.shouldSkip('Faculty research grant in additive manufacturing', skip));
  assert.deepEqual(scout.currentSkip([]), []);
  assert.deepEqual(scout.parseSkip(' Fee \nfee\n\nK-12'), ['fee', 'k-12']);
  assert.ok(scout.shouldSkip('Grades K-12 mural', ['k-12']));
});
