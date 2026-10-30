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
  new Function('require', 'module', 'exports', code)(name => { if (name.startsWith('@/lib/')) return load(`lib/${name.slice(6)}.ts`); throw new Error(`Unexpected import ${name}`); }, mod, mod.exports);
  return mod.exports;
}
const practice = load('lib/practice.ts');
const today = '2026-10-29';
const opp = (over) => ({ id: 'o', title: 'Call', notes: '', kind: 'exhibition', organization: 'Gallery', location: '', deadline: '', url: '', fee: '', award: '', status: 'interested', materials: [], cvEntryId: '', decidedAt: '', ...over });
const person = (over) => ({ id: 'c', name: 'Jane', notes: '', role: 'curator', organization: 'Museum', email: '', phone: '', website: '', instagram: '', city: '', howMet: '', followUp: '', log: [], ...over });

test('the agenda gathers the next two weeks by day, with slipped follow-ups pinned to today', () => {
  const groups = practice.agenda({
    today, reviewDate: '2026-11-05',
    opportunities: [
      opp({ id: 'a', title: 'Residency', deadline: '2026-11-05', materials: [{ label: 'CV', done: true }, { label: 'Statement', done: false }] }),
      opp({ id: 'b', title: 'Sent already', deadline: '2026-11-01', status: 'submitted' }),
      opp({ id: 'c', title: 'Passed', deadline: '2026-10-20' }),
      opp({ id: 'd', title: 'Far off', deadline: '2026-12-30' }),
    ],
    contacts: [person({ id: 'x', name: 'Late', followUp: '2026-10-20' }), person({ id: 'y', name: 'Soon', followUp: '2026-10-30' })],
  });
  assert.deepEqual(groups.map(group => group.label), ['Today', 'Tomorrow', 'Thu, Nov 5']);
  assert.equal(groups[0].items[0].overdue, true);
  assert.match(groups[0].items[0].detail, /was due Tue, Oct 20/);
  assert.deepEqual(groups[2].items.map(item => item.kind), ['review', 'deadline']);
  assert.equal(groups[2].items[1].detail, 'Gallery · 1/2 materials ready');
  assert.equal(groups[2].items[1].href, '/opportunities?o=a');
});

test('the summary line reads the week in plain words', () => {
  const groups = practice.agenda({ today, reviewDate: '', opportunities: [opp({ deadline: '2026-10-31' }), opp({ id: 'b', deadline: '2026-11-02' })], contacts: [person({ followUp: '2026-10-29' })] });
  assert.equal(practice.summaryLine(groups, today), 'This week: two deadlines and one person to follow up with.');
  assert.equal(practice.summaryLine([], today), 'A clear week. Nothing on the calendar for the next two weeks.');
  const later = practice.agenda({ today, reviewDate: '', opportunities: [opp({ deadline: '2026-11-10' })], contacts: [] });
  assert.equal(practice.summaryLine(later, today), 'A clear week. The next thing on the calendar is further out.');
});

test('the glance tiles count what needs attention', () => {
  const g = practice.glance({
    today, reviewDate: '2027-09-01', statements: ['Teaching statement', '', '  '], evidence: 7,
    opportunities: [opp({ id: 'a', title: 'Later', deadline: '2026-12-01' }), opp({ id: 'b', title: 'Sooner', deadline: '2026-11-03', status: 'preparing' }), opp({ id: 'c', status: 'submitted' }), opp({ id: 'd', status: 'accepted', decidedAt: '2026-06-01T00:00:00Z' })],
    contacts: [person({ followUp: '2026-10-29' }), person({ log: [{ date: '2025-01-01', text: 'Email' }] }), person({ log: [{ date: '2026-10-01', text: 'Visit' }] }), person({})],
    cv: [{ category: 'group_exhibition', date: '2026-03' }, { category: 'group_exhibition', date: '2026' }, { category: 'publication', date: '2026' }, { category: 'award', date: '2025' }],
  });
  assert.equal(g.applications.next.title, 'Sooner');
  assert.equal(g.applications.nextLabel, '5 days left');
  assert.equal(g.applications.active, 2);
  assert.equal(g.applications.waiting, 1);
  assert.deepEqual(g.people, { due: 1, quiet: 1, total: 4 });
  assert.equal(g.tenure.written, 1);
  assert.equal(g.tenure.label, 'About 10 months to go');
  assert.equal(g.year.logged, 3);
  assert.equal(g.year.top, '2 group exhibitions');
  assert.equal(g.year.accepted, 1);
});

test('recent work is newest first and capped', () => {
  const items = practice.recentWork([{ at: '2026-10-01', title: 'a' }, { at: '', title: 'skip' }, { at: '2026-10-28T10:00:00Z', title: 'b' }, { at: '2026-10-05', title: 'c' }], 2);
  assert.deepEqual(items.map(item => item.title), ['b', 'c']);
});
