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
const dossier = load('lib/dossier.ts');
const id = '11111111-1111-4111-8111-111111111111';

test('the dossier has teaching, research, and service sections', () => {
  assert.deepEqual(dossier.dossierSections.map(section => section.key), ['teaching', 'research', 'service']);
  assert.equal(dossier.parseSection('service'), 'service');
  assert.equal(dossier.parseSection('settings'), null);
  assert.equal(dossier.sectionLabel('research'), 'Research & creative work');
});
test('evidence can be any workspace record with a real id', () => {
  assert.deepEqual(dossier.parseEvidence(`media:${id}`), { kind: 'media', id });
  assert.deepEqual(dossier.parseEvidence(`research_thread:${id}`), { kind: 'research_thread', id });
  assert.equal(dossier.parseEvidence(`profile:${id}`), null);
  assert.equal(dossier.parseEvidence('note:nope'), null);
  assert.equal(dossier.parseEvidence(undefined), null);
});
test('journal entries can be filed into a section from the link menu', () => {
  assert.equal(dossier.parseDossierLink('dossier:teaching'), 'teaching');
  assert.equal(dossier.parseDossierLink('dossier:settings'), null);
  assert.equal(dossier.parseDossierLink(`project:${id}`), null);
  assert.deepEqual(dossier.dossierLinkGroup.options.map(option => option.value), ['dossier:teaching', 'dossier:research', 'dossier:service']);
});
test('review dates are real calendar days and count down in plain words', () => {
  assert.equal(dossier.parseReviewDate('2027-09-15'), '2027-09-15');
  assert.equal(dossier.parseReviewDate('2027-02-30'), null);
  assert.equal(dossier.parseReviewDate('soon'), null);
  assert.equal(dossier.daysUntil('2026-11-08', '2026-10-29'), 10);
  assert.equal(dossier.countdownLabel(0), 'Today');
  assert.equal(dossier.countdownLabel(1), '1 day to go');
  assert.equal(dossier.countdownLabel(10), '10 days to go');
  assert.equal(dossier.countdownLabel(321), 'About 11 months to go');
  assert.equal(dossier.countdownLabel(1000), 'About 3 years to go');
  assert.equal(dossier.countdownLabel(-3), '3 days ago');
});
test('statements count words', () => {
  assert.equal(dossier.wordCount(''), 0);
  assert.equal(dossier.wordCount('  Clay as   a record of time. '), 6);
});
