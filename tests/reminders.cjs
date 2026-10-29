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
const reminders = load('lib/reminders.ts', { '@/lib/journal': load('lib/journal.ts') });

test('reminder times must be real dates within a sensible range', () => {
  assert.equal(reminders.parseRemindAt('2026-10-30T13:00:00.000Z'), '2026-10-30T13:00:00.000Z');
  assert.equal(reminders.parseRemindAt('soon'), null);
  assert.equal(reminders.parseRemindAt(''), null);
  assert.equal(reminders.parseRemindAt(42), null);
  assert.equal(reminders.parseRemindAt('1990-01-01T00:00:00Z'), null);
});
test('presets always land in the future, in order', () => {
  for (const hour of [8, 15, 17, 23]) {
    const now = new Date(2026, 9, 29, hour, 7);
    const presets = reminders.reminderPresets(now);
    assert.deepEqual(presets.map(p => p.label), ['In 1 hour', 'Later today', 'Tomorrow 9am', 'Next Monday']);
    for (const preset of presets) assert.ok(preset.at > now, `${preset.label} at ${hour}h`);
    assert.equal(presets[2].at.getHours(), 9);
    assert.equal(presets[3].at.getDay(), 1);
  }
  assert.equal(reminders.reminderPresets(new Date(2026, 9, 29, 10, 0)).find(p => p.label === 'Later today').at.getHours(), 17);
});
test('reminders sort into overdue, today, and upcoming by the studio day', () => {
  const now = new Date('2026-10-29T16:00:00Z'); // noon in New York
  assert.equal(reminders.reminderBucket('2026-10-29T15:00:00Z', now), 'overdue');
  assert.equal(reminders.reminderBucket('2026-10-30T02:00:00Z', now), 'today'); // 10pm New York
  assert.equal(reminders.reminderBucket('2026-10-30T05:00:00Z', now), 'upcoming');
});
test('reminder labels speak in days people use', () => {
  const now = new Date('2026-10-29T16:00:00Z');
  assert.equal(reminders.formatReminder('2026-10-29T21:00:00Z', now), 'Today 5:00 PM');
  assert.equal(reminders.formatReminder('2026-10-30T13:00:00Z', now), 'Tomorrow 9:00 AM');
  assert.equal(reminders.formatReminder('2026-10-28T13:00:00Z', now), 'Yesterday 9:00 AM');
  assert.equal(reminders.formatReminder('2026-11-06T14:00:00Z', now), 'Fri, Nov 6, 9:00 AM');
});
test('the composer can label a reminder in the browser time zone', () => {
  const now = new Date('2026-10-29T16:00:00Z');
  assert.equal(reminders.formatReminder('2026-10-30T09:00:00Z', now, 'UTC'), 'Tomorrow 9:00 AM');
});
