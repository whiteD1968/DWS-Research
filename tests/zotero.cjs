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
const z = load('lib/zotero.ts');
const sync = load('lib/zotero-sync.ts');

test('keys, IDs, and collections are validated', () => {
  assert.equal(z.parseZoteroKey(' abcdefghijklmnopqrstuvwx '), 'abcdefghijklmnopqrstuvwx');
  assert.equal(z.parseZoteroKey('short'), '');
  assert.equal(z.parseZoteroUserId('123456'), '123456');
  assert.equal(z.parseZoteroUserId('12a'), '');
  assert.equal(z.parseCollectionKey('abcd1234'), 'ABCD1234');
  assert.equal(z.parseCollectionKey('abc'), '');
  assert.equal(z.itemsUrl({ userId: '1', collection: 'ABCD1234' }, 40, 100), 'https://api.zotero.org/users/1/collections/ABCD1234/items/top?format=json&since=40&start=100&limit=100&sort=dateModified&direction=asc');
});

test('items map to a source and a reference; notes and attachments are skipped', () => {
  const r = z.zoteroRecord({ key: 'K1', version: 7, data: { key: 'K1', itemType: 'journalArticle', title: ' Clay  and Time ', creators: [{ creatorType: 'author', firstName: 'Ana', lastName: 'Ruiz' }, { creatorType: 'author', name: 'Studio Collective' }, { creatorType: 'translator', lastName: 'X' }], date: 'Spring 2019', DOI: 'https://doi.org/10.1/abc', publicationTitle: 'Ceramics Review', abstractNote: 'About kilns.', tags: [{ tag: 'wood-fire' }] } });
  assert.equal(r.reference.title, 'Clay and Time');
  assert.equal(r.reference.reference_type, 'article');
  assert.equal(r.reference.creator, 'Ana Ruiz and Studio Collective');
  assert.equal(r.reference.reference_date, '2019');
  assert.equal(r.source.doi, '10.1/abc');
  assert.equal(r.source.url, 'https://doi.org/10.1/abc');
  assert.deepEqual(r.reference.metadata.zotero.tags, ['wood-fire']);
  assert.equal(z.zoteroRecord({ data: { key: 'N', itemType: 'note' } }), null);
  assert.equal(z.zoteroRecord({ data: { key: 'A', itemType: 'book', parentItem: 'K1' } }), null);
  assert.equal(z.zoteroRecord({ data: { key: 'B', itemType: 'artwork', url: 'javascript:alert(1)' } }).source.url, null);
  assert.equal(z.creatorsLabel([{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }]), 'A et al.');
});

// A tiny in-memory stand-in for the Supabase query builder, covering the calls the sync makes.
function fakeDb(tables) {
  let next = 1;
  return {
    tables,
    from(table) {
      const rows = tables[table] ||= [];
      let filters = []; let op = 'select'; let payload; let wantCount = false; let single = false; let returning = false;
      const match = row => filters.every(f => f(row));
      const q = {
        select(_cols, opts) { if (op === 'select') wantCount = !!opts?.count; else returning = true; return q; },
        eq(k, v) { filters.push(r => r[k] === v); return q; },
        in(k, vs) { filters.push(r => vs.includes(r[k])); return q; },
        order() { return q; }, limit() { return q; },
        maybeSingle() { single = true; return q; }, single() { single = true; return q; },
        insert(data) { op = 'insert'; payload = data; return q; },
        update(data) { op = 'update'; payload = data; return q; },
        delete() { op = 'delete'; return q; },
        then(resolve) {
          if (op === 'insert') { const made = (Array.isArray(payload) ? payload : [payload]).map(r => ({ id: `id${next++}`, ...r })); rows.push(...made); return resolve({ data: returning ? made : null, error: null }); }
          if (op === 'update') { rows.filter(match).forEach(r => Object.assign(r, payload)); return resolve({ data: null, error: null }); }
          const found = rows.filter(match);
          if (wantCount) return resolve({ count: found.length, data: null, error: null });
          return resolve({ data: single ? found[0] ?? null : found, error: null });
        },
      };
      return q;
    },
  };
}
const item = (n, over = {}) => ({ key: `K${n}`, version: n, data: { key: `K${n}`, itemType: 'book', title: `Book ${n}`, ...over } });

test('sync adds new items, updates known ones in place, and remembers the library version', async () => {
  const owner = 'o1';
  const db = fakeDb({ notes: [{ id: 's', owner_id: owner, parent_type: 'zotero_settings', metadata: { user_id: '9', api_key: 'abcdefghijklmnopqrstuvwx', version: 0 } }], sources: [], references: [] });
  const calls = [];
  global.fetch = async url => { calls.push(String(url)); const since = new URL(url).searchParams.get('since'); const items = since === '0' ? [item(1), item(2)] : [item(2, { title: 'Book 2, revised' })]; return { ok: true, status: 200, headers: { get: () => (since === '0' ? '50' : '60') }, json: async () => items }; };
  let result = await sync.syncZoteroFor(db, owner);
  assert.deepEqual([result.added, result.updated, result.complete], [2, 0, true]);
  assert.equal(db.tables.references.length, 2);
  assert.equal(db.tables.notes[0].metadata.version, 50);
  assert.equal(db.tables.notes[0].metadata.imported, 2);
  db.tables.references[1].why_saved = 'For the glaze chapter';
  result = await sync.syncZoteroFor(db, owner);
  assert.deepEqual([result.added, result.updated], [0, 1]);
  assert.equal(db.tables.references.length, 2);
  assert.equal(db.tables.references[1].title, 'Book 2, revised');
  assert.equal(db.tables.references[1].why_saved, 'For the glaze chapter');
  assert.equal(db.tables.notes[0].metadata.version, 60);
  assert.match(calls[1], /since=50/);
});

test('a capped or failed run resumes from where it stopped without advancing the version', async () => {
  const owner = 'o1';
  const db = fakeDb({ notes: [{ id: 's', owner_id: owner, parent_type: 'zotero_settings', metadata: { user_id: '9', api_key: 'abcdefghijklmnopqrstuvwx', version: 10 } }], sources: [], references: [] });
  let page = 0;
  global.fetch = async () => { page += 1; if (page === 3) return { ok: false, status: 503, headers: { get: () => null }, json: async () => ({}) }; return { ok: true, status: 200, headers: { get: () => '99' }, json: async () => Array.from({ length: 100 }, (_, i) => item(page * 1000 + i)) }; };
  const result = await sync.syncZoteroFor(db, owner);
  assert.equal(result.added, 200); assert.equal(result.complete, false); assert.match(result.failure, /busy/);
  assert.equal(db.tables.notes[0].metadata.version, 10);
  assert.equal(db.tables.notes[0].metadata.resume_start, 200);
  global.fetch = async () => ({ ok: false, status: 403, headers: { get: () => null }, json: async () => ({}) });
  await assert.rejects(sync.syncZoteroFor(db, owner), /turned down the API key/);
});
