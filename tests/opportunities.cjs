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
const opp = load('lib/opportunities.ts');
const item = (fields) => ({ id: 'x', title: 'Call', notes: '', kind: 'exhibition', organization: '', location: '', deadline: '', url: '', fee: '', award: '', status: 'interested', materials: [], cvEntryId: '', decidedAt: '', ...fields });

test('opportunity rows read safely from note metadata', () => {
  const parsed = opp.opportunityFrom({ id: '1', title: ' Open Call ', metadata: { kind: 'grant', status: 'bogus', materials: [{ label: 'Budget', done: 1 }, { nope: true }] } });
  assert.equal(parsed.title, 'Open Call');
  assert.equal(parsed.status, 'interested');
  assert.deepEqual(parsed.materials, [{ label: 'Budget', done: true }]);
  assert.equal(opp.opportunityFrom({ metadata: { kind: 'party' } }), null);
});
test('deadlines read in plain words and flag the last week', () => {
  assert.equal(opp.parseDeadline('2026-11-08'), '2026-11-08');
  assert.equal(opp.parseDeadline(''), '');
  assert.equal(opp.parseDeadline('2026-02-30'), null);
  assert.equal(opp.deadlineLabel('2026-10-29', '2026-10-29'), 'Due today');
  assert.equal(opp.deadlineLabel('2026-10-30', '2026-10-29'), 'Due tomorrow');
  assert.equal(opp.deadlineLabel('2026-11-03', '2026-10-29'), '5 days left');
  assert.equal(opp.deadlineLabel('2026-12-15', '2026-10-29'), 'Due Dec 15');
  assert.equal(opp.deadlineLabel('2026-10-01', '2026-10-29'), 'Closed Oct 1');
  assert.equal(opp.deadlineTone('2026-11-03', '2026-10-29', 'preparing'), 'soon');
  assert.equal(opp.deadlineTone('2026-11-03', '2026-10-29', 'submitted'), 'calm');
});
test('reminders land a week ahead at 9am Eastern, or the day before when close', () => {
  assert.equal(opp.reminderFor('2026-12-15', '2026-10-29'), '2026-12-08T14:00:00.000Z');
  assert.equal(opp.reminderFor('2026-11-03', '2026-10-29'), '2026-11-02T14:00:00.000Z');
  assert.equal(opp.reminderFor('2026-07-20', '2026-06-01'), '2026-07-13T13:00:00.000Z');
  assert.equal(opp.reminderFor('2026-10-29', '2026-10-29'), null);
  assert.equal(opp.reminderFor('', '2026-10-29'), null);
});
test('each kind starts with a sensible checklist and maps to a CV section', () => {
  assert.deepEqual(opp.defaultMaterials('grant').map(m => m.label), ['Project proposal', 'Budget', 'CV', 'Work samples', 'Letters of support']);
  assert.equal(opp.opportunityKind('residency').cv, 'residency');
  assert.equal(opp.stageOf('declined'), 'decided');
  assert.equal(opp.stageOf('preparing'), 'preparing');
});
test('season stats count what went out, what came back, and fees', () => {
  const stats = opp.seasonStats([
    item({ status: 'accepted', deadline: '2026-03-01', fee: '$35' }),
    item({ status: 'declined', deadline: '2026-04-01', fee: '25' }),
    item({ status: 'submitted', deadline: '2026-09-01', fee: '$40.00' }),
    item({ status: 'preparing', deadline: '2026-12-01', fee: '$99' }),
    item({ status: 'accepted', deadline: '2025-03-01', fee: '$10' }),
  ], '2026');
  assert.deepEqual(stats, { submitted: 3, accepted: 1, rate: 50, fees: 100 });
});
