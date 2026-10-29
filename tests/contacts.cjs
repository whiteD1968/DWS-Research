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
const contacts = load('lib/contacts.ts');
const opp = load('lib/opportunities.ts');

test('contacts read safely from note metadata, newest touchpoint first', () => {
  const contact = contacts.contactFrom({ id: '1', title: ' Jane Doe ', metadata: { role: 'curator', instagram: '@jane', follow_up: '2026-11-02', log: [{ date: '2026-01-02', text: 'Email' }, { date: '2026-05-01', text: 'Studio visit' }, { date: 'bad', text: 'x' }, { date: '2026-02-01', text: ' ' }] } });
  assert.equal(contact.name, 'Jane Doe');
  assert.equal(contact.instagram, 'jane');
  assert.deepEqual(contact.log.map(t => t.text), ['Studio visit', 'Email']);
  assert.equal(contacts.contactFrom({ title: '', metadata: {} }), null);
  assert.equal(contacts.contactFrom({ title: 'A', metadata: { role: 'wizard' } }).role, 'other');
});
test('last-in-touch reads in plain words, and six quiet months earns a nudge', () => {
  assert.equal(contacts.touchLabel('', '2026-10-29'), 'No touchpoints yet');
  assert.equal(contacts.touchLabel('2026-10-29', '2026-10-29'), 'In touch today');
  assert.equal(contacts.touchLabel('2026-10-20', '2026-10-29'), 'In touch 9 days ago');
  assert.equal(contacts.touchLabel('2026-09-29', '2026-10-29'), 'In touch 4 weeks ago');
  assert.equal(contacts.touchLabel('2026-04-29', '2026-10-29'), 'In touch 6 months ago');
  assert.equal(contacts.touchLabel('2024-10-29', '2026-10-29'), 'In touch 2 years ago');
  assert.equal(contacts.isQuiet({ log: [] }, '2026-10-29'), true);
  assert.equal(contacts.isQuiet({ log: [{ date: '2026-06-01', text: 'x' }] }, '2026-10-29'), false);
  assert.equal(contacts.isQuiet({ log: [{ date: '2026-04-01', text: 'x' }] }, '2026-10-29'), true);
});
test('search covers names, organizations, cities, and roles', () => {
  const contact = contacts.contactFrom({ id: '1', title: 'Jane Doe', metadata: { role: 'juror', organization: 'Clay Art Center', city: 'Port Chester' } });
  assert.equal(contacts.matchesContact(contact, 'clay art'), true);
  assert.equal(contacts.matchesContact(contact, 'juror'), true);
  assert.equal(contacts.matchesContact(contact, 'chester'), true);
  assert.equal(contacts.matchesContact(contact, 'nobody'), false);
});
test('websites gain a scheme and bad ones are refused', () => {
  assert.equal(contacts.normalizeWebsite('example.com'), 'https://example.com/');
  assert.equal(contacts.normalizeWebsite('http://a.org/x'), 'http://a.org/x');
  assert.equal(contacts.normalizeWebsite(''), '');
  assert.equal(contacts.normalizeWebsite('not a site'), null);
});
test('CSV export quotes safely and neutralizes formula-like cells', () => {
  const contact = contacts.contactFrom({ id: '1', title: 'Doe, Jane', plain_text: '=HYPERLINK("x")', metadata: { role: 'curator', log: [{ date: '2026-05-01', text: 'Hi' }] } });
  const csv = contacts.contactsCsv([contact]).split('\r\n');
  assert.equal(csv[0].split(',')[0], 'Name');
  assert.ok(csv[1].startsWith('"Doe, Jane",Curator,'));
  assert.ok(csv[1].includes(',2026-05-01,'));
  assert.ok(csv[1].endsWith('"\'=HYPERLINK(""x"")"'));
});
test('follow-ups land at 9am Eastern', () => {
  assert.equal(opp.nineAmEastern('2026-11-02'), '2026-11-02T14:00:00.000Z');
  assert.equal(opp.nineAmEastern('2026-07-01'), '2026-07-01T13:00:00.000Z');
});
