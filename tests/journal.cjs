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
const journal = load('lib/journal.ts');

test('entry dates accept real calendar days and fall back to today', () => {
  assert.equal(journal.parseEntryDate('2026-10-12', '2026-10-28'), '2026-10-12');
  assert.equal(journal.parseEntryDate('2026-02-30', '2026-10-28'), '2026-10-28');
  assert.equal(journal.parseEntryDate('yesterday', '2026-10-28'), '2026-10-28');
  assert.equal(journal.parseEntryDate(undefined, '2026-10-28'), '2026-10-28');
});
test('journal links only accept projects and research topics', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  assert.deepEqual(journal.parseJournalLink(`project:${id}`), { kind: 'project', id });
  assert.deepEqual(journal.parseJournalLink(`research_thread:${id}`), { kind: 'research_thread', id });
  assert.equal(journal.parseJournalLink(`board:${id}`), null);
  assert.equal(journal.parseJournalLink('project:nope'), null);
  assert.equal(journal.parseJournalLink(''), null);
});
test('entries group under their journal day, falling back to when they were written', () => {
  const rows = [
    { id: 1, metadata: { entry_date: '2026-10-28' } },
    { id: 2, metadata: { entry_date: '2026-10-28' } },
    { id: 3, metadata: {}, created_at: '2026-10-20T14:00:00Z' },
  ];
  assert.deepEqual(journal.groupByDay(rows, journal.entryDay).map(g => [g.day, g.entries.map(e => e.id)]), [['2026-10-28', [1, 2]], ['2026-10-20', [3]]]);
  assert.equal(journal.formatDay('2026-10-28'), 'Wednesday, October 28, 2026');
});
