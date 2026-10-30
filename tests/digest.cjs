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
const digest = load('lib/digest.ts');
const opp = (over) => ({ id: 'o', title: 'Call', notes: '', kind: 'exhibition', organization: '', location: '', deadline: '', url: '', fee: '', award: '', status: 'interested', materials: [], cvEntryId: '', decidedAt: '', ...over });
const person = (over) => ({ id: 'c', name: 'Jane', notes: '', role: 'curator', organization: '', email: '', phone: '', website: '', instagram: '', city: '', howMet: '', followUp: '', log: [], ...over });
const now = new Date('2026-10-30T11:00:00Z'); // 7am in New York

test('settings read safely and the job sends once, only at 7am New York time', () => {
  const s = digest.digestSettingsFrom({ enabled: true, email: ' Me@Example.com ' });
  assert.deepEqual(s, { enabled: true, email: 'me@example.com', lastSent: '' });
  assert.equal(digest.digestSettingsFrom({ enabled: 'yes' }, 'x@y.co').enabled, false);
  assert.equal(digest.digestSettingsFrom({}, 'x@y.co').email, 'x@y.co');
  assert.equal(digest.parseEmail('not an email'), '');
  assert.equal(digest.digestDue(s, now), true);
  assert.equal(digest.digestDue(s, new Date('2026-10-30T12:00:00Z')), false); // 8am EDT
  assert.equal(digest.digestDue(s, new Date('2026-12-01T12:00:00Z')), true); // 7am EST
  assert.equal(digest.digestDue(s, new Date('2026-12-01T11:00:00Z')), false);
  assert.equal(digest.digestDue({ ...s, lastSent: '2026-10-30' }, now), false);
  assert.equal(digest.digestDue({ ...s, enabled: false }, now), false);
});

test('the digest gathers today, the week, follow-ups, and fresh leads, and skips quiet mornings', () => {
  const d = digest.buildDigest({
    now, baseUrl: 'https://dws.example', reviewDate: '',
    reminders: [
      { id: 'r1', title: 'Glaze tests', plain_text: 'Pull tiles', parent_type: 'journal', metadata: { remind_at: '2026-10-30T13:00:00Z' } },
      { id: 'r2', title: '', plain_text: 'Order clay', parent_type: null, metadata: { remind_at: '2026-10-28T13:00:00Z' } },
      { id: 'r3', title: 'Tomorrow', plain_text: '', parent_type: null, metadata: { remind_at: '2026-10-31T13:00:00Z' } },
      { id: 'r4', title: 'Opp reminder', plain_text: '', parent_type: 'opportunity', metadata: { remind_at: '2026-10-29T13:00:00Z' } },
    ],
    opportunities: [opp({ id: 'a', title: 'Residency <Fall>', deadline: '2026-11-02', organization: 'Ox-Bow' }), opp({ id: 'b', title: 'Later', deadline: '2026-11-20' })],
    contacts: [person({ id: 'x', name: 'Maya', followUp: '2026-10-25' }), person({ id: 'y', name: 'Not yet', followUp: '2026-11-03' })],
    leads: [{ id: 'l', title: 'New call', url: 'https://x', source: 'CaFE', summary: '', query: '', foundAt: '2026-10-30T10:30:00Z', deadline: '', kind: 'other' }, { id: 'm', title: 'Old', url: 'https://y', source: '', summary: '', query: '', foundAt: '2026-10-20T10:00:00Z', deadline: '', kind: 'other' }],
  });
  assert.deepEqual(d.sections.map(s => s.heading), ['Today', 'Deadlines this week', 'Follow up', 'New leads from the scout']);
  assert.deepEqual(d.sections[0].lines.map(l => l.title), ['Order clay', 'Glaze tests']);
  assert.equal(d.sections[0].lines[0].detail, 'Overdue since Wed, Oct 28');
  assert.equal(d.sections[0].lines[1].detail, '9:00 AM');
  assert.equal(d.sections[1].lines[0].href, 'https://dws.example/opportunities?o=a');
  assert.deepEqual(d.sections[2].lines.map(l => l.title), ['Maya']);
  assert.deepEqual(d.sections[3].lines.map(l => l.title), ['New call']);
  assert.equal(d.subject, 'Friday, October 30: 2 reminders · 1 deadline this week · 1 to follow up · 1 new lead');
  assert.ok(d.html.includes('Residency &lt;Fall&gt;') && !d.html.includes('<Fall>'));
  assert.ok(d.text.includes('https://dws.example/contacts?c=x'));
  const quiet = { now, baseUrl: 'https://dws.example', reviewDate: '', reminders: [], opportunities: [], contacts: [], leads: [] };
  assert.equal(digest.buildDigest(quiet), null);
  assert.equal(digest.buildDigest({ ...quiet, quiet: true }).sections[0].lines[0].title, 'Nothing due. A clear morning.');
});

test('an upcoming tenure review leads the email', () => {
  const d = digest.buildDigest({ now, baseUrl: 'https://dws.example', reviewDate: '2026-11-01', reminders: [], opportunities: [], contacts: [], leads: [] });
  assert.equal(d.sections[0].heading, 'Tenure review');
  assert.equal(d.sections[0].lines[0].title, 'Your review is on Sun, Nov 1');
  assert.match(d.subject, /tenure review soon/);
});
