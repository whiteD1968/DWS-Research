/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
function load(file) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => { throw new Error(`Unexpected import ${name}`); }, mod, mod.exports);
  return mod.exports;
}
const cal = load('lib/calendar-feed.ts');
const now = new Date('2026-10-30T13:00:00Z');
const row = (over) => ({ id: 'a', kind: 'deadline', title: 'Residency', detail: 'Ox-Bow', day: '2026-11-04', at: null, status: 'preparing', updated_at: '2026-10-29T10:00:00Z', ...over });

test('tokens are long, URL-safe, and unique', () => {
  const a = cal.newCalendarToken(), b = cal.newCalendarToken();
  assert.match(a, cal.calendarTokenPattern); assert.equal(a.length, 43); assert.notEqual(a, b);
});

test('feed rows become dated events, dropping stale or malformed ones', () => {
  const events = cal.feedEvents([
    row({}), row({ id: null, kind: 'feed' }),
    row({ id: 'b', kind: 'follow_up', title: 'Maya', detail: 'Clay Studio', day: '2026-11-01' }),
    row({ id: 'c', kind: 'review', title: 'Tenure review', day: '2027-09-01' }),
    row({ id: 'd', kind: 'reminder', title: 'Glaze tests', detail: 'Pull tiles', day: null, at: '2026-10-31T13:00:00Z' }),
    row({ id: 'e', day: '2026-08-01' }), row({ id: 'f', day: '2026-02-30' }), row({ id: 'g', kind: 'reminder', at: 'nope' }),
  ], 'https://dws.example', now);
  assert.deepEqual(events.map(e => e.uid), ['reminder-d', 'follow-up-b', 'deadline-a', 'review-c']);
  assert.equal(events[2].summary, 'Deadline: Residency'); assert.equal(events[2].description, 'Ox-Bow · Preparing');
  assert.equal(events[1].url, 'https://dws.example/contacts?c=b');
});

test('the ics file follows RFC 5545: CRLF, escaping, all-day ends, and 75-octet folding', () => {
  const events = cal.feedEvents([row({ title: 'Glass, clay; and \\ more', detail: 'Line one\nline two' }), row({ id: 'd', kind: 'reminder', title: 'é'.repeat(60), day: null, at: '2026-10-31T13:00:00Z' })], 'https://dws.example', now);
  const ics = cal.toIcs(events, 'dws.example');
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.includes('SUMMARY:Deadline: Glass\\, clay\\; and \\\\ more\r\n'));
  assert.match(ics, /DESCRIPTION:Line one\\nline two/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261104\r\nDTEND;VALUE=DATE:20261105/);
  assert.match(ics, /DTSTART:20261031T130000Z\r\nDURATION:PT15M/);
  assert.match(ics, /UID:deadline-a@dws\.example/);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, line);
  const unfolded = ics.replace(/\r\n /g, '');
  assert.ok(unfolded.includes(`SUMMARY:${'é'.repeat(60)}`));
});

test('calendar_feed returns slim rows for a valid token only, and anon can call it', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated; create role anon;
      create schema auth; create schema storage;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table storage.buckets (id text primary key, name text, public boolean);
      create table storage.objects (id uuid, bucket_id text, name text);
      create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
    `);
    await db.exec(fs.readFileSync('supabase/migrations/20260911193000_initial_dws_research_schema.sql', 'utf8').replace('create extension if not exists pgcrypto;', ''));
    await db.exec(fs.readFileSync('supabase/migrations/20261030140000_calendar_feed.sql', 'utf8'));
    await db.exec('grant usage on schema public, auth to authenticated, anon;');
    const owner = '10000000-0000-4000-8000-000000000001', other = '10000000-0000-4000-8000-000000000002';
    const token = 'A'.repeat(43), otherToken = 'B'.repeat(43);
    await db.query('insert into auth.users(id) values ($1),($2)', [owner, other]);
    const note = (who, parent, title, metadata, text = null) => db.query('insert into notes(owner_id,parent_type,title,plain_text,metadata) values ($1,$2,$3,$4,$5)', [who, parent, title, text, JSON.stringify(metadata)]);
    await note(owner, 'calendar_settings', 'Calendar feed', { token });
    await note(other, 'calendar_settings', 'Calendar feed', { token: otherToken });
    await note(owner, 'opportunity', 'Residency', { deadline: '2026-11-04', status: 'preparing', organization: 'Ox-Bow', remind_at: '2026-10-28T13:00:00Z' });
    await note(owner, 'opportunity', 'Sent', { deadline: '2026-11-05', status: 'submitted' });
    await note(owner, 'contact', 'Maya', { follow_up: '2026-11-01', organization: 'Clay Studio', email: 'maya@example.com', phone: '555' });
    await note(owner, 'dossier_settings', null, { review_date: '2027-09-01' });
    await note(owner, 'journal', 'Glaze tests', { remind_at: '2026-10-31T13:00:00Z' }, 'Pull the tiles');
    await note(owner, 'journal', 'Done one', { remind_at: '2026-10-20T13:00:00Z', done_at: '2026-10-21T00:00:00Z' });
    await note(other, 'opportunity', 'Not mine', { deadline: '2026-11-04', status: 'interested' });
    await db.exec('set role anon');
    const feed = async t => (await db.query('select * from public.calendar_feed($1)', [t])).rows;
    const rows = await feed(token);
    assert.deepEqual(rows.map(r => r.kind).sort(), ['deadline', 'feed', 'follow_up', 'reminder', 'review']);
    assert.ok(!JSON.stringify(rows).includes('maya@example.com'));
    assert.equal(rows.find(r => r.kind === 'reminder').detail, 'Pull the tiles');
    assert.ok(!rows.some(r => r.title === 'Not mine'));
    assert.deepEqual(await feed('C'.repeat(43)), []);
    assert.deepEqual(await feed('short'), []);
    assert.deepEqual(await feed("x' or '1'='1"), []);
    await assert.rejects(db.query('select * from notes'), /permission denied/);
  } finally { await db.close(); }
});
