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
  assert.equal(scout.parseSearches('a\nb\nc\nd\ne\nf\ng').length, 6);
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
