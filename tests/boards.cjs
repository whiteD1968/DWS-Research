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
const layout = load('lib/boards/layout.ts');
const record = (id, role = 'visual', extra = {}) => ({ key: `reference:${id}`, id, type: 'reference', title: id, subtitle: '', role, themeIds: [], topicIds: ['topic'], href: '/', ...extra });
for (const mode of layout.layouts) test(`${mode}: deterministic layout, finite bounds, no overlapping cards`, () => {
  const records = Array.from({ length: 100 }, (_, i) => record(`${i}`, ['visual', 'evidence', 'thinking'][i % 3]));
  const result = layout.generateComposition(records, mode);
  assert.deepEqual(result, layout.generateComposition([...records].reverse(), mode));
  assert.equal(result.placements.length, 100);
  for (const p of result.placements) {
    const f = result.frames[p.frame];
    assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= f.w && p.y + p.h <= f.h);
    for (const other of result.placements.filter(o => o !== p && o.frame === p.frame)) assert.ok(p.x + p.w <= other.x || other.x + other.w <= p.x || p.y + p.h <= other.y || other.y + other.h <= p.y);
  }
});
test('theme clustering duplicates placements, not underlying records', () => {
  const records = [record('a', 'thinking', { key: 'theme:a', type: 'theme' }), record('b', 'thinking', { key: 'theme:b', type: 'theme' }), record('ref', 'visual', { themeIds: ['a', 'b'] })];
  const result = layout.generateComposition(records, 'theme_clusters');
  assert.equal(result.placements.filter(p => p.key === 'reference:ref').length, 2);
  assert.equal(records.length, 3);
});
test('empty manual board and selection cap', () => {
  assert.deepEqual(layout.generateComposition([], 'research_wall'), { frames: [], placements: [] });
  assert.throws(() => layout.generateComposition(Array.from({ length: 101 }, (_, i) => record(`${i}`)), 'research_wall'), /100/);
  assert.equal(layout.generateComposition([record('a'), record('a')], 'contact_sheet').placements.length, 1);
});
test('unselected theme descriptors still organize selected records without adding cards', () => {
  const result = layout.generateComposition([record('ref', 'visual', { themeIds: ['a'] })], 'theme_clusters', [record('a', 'thinking', { key: 'theme:a', type: 'theme', title: 'Material systems' })]);
  assert.equal(result.frames[0].title, 'Material systems');
  assert.equal(result.placements.length, 1);
  assert.equal(result.placements[0].key, 'reference:ref');
});
function actions({ authenticated = true, owned = true, conflict = false } = {}) {
  const calls = [];
  const db = { from(table) {
    const q = { select() { return q; }, eq(key, value) { calls.push([table, key, value]); return q; }, async single() { return { data: owned ? { id: 'board', research_thread_id: 'topic' } : null }; } }; return q;
  }, async rpc(name, args) { calls.push([name, args]); return conflict ? { error: { message: 'Board changed in another session. Reload before editing.' } } : { data: 'next-revision' }; } };
  return { calls, api: load('app/(workspace)/boards/actions.ts', {
    '@/lib/auth': { requireUser: async () => { if (!authenticated) throw new Error('Authentication required'); return { id: 'owner' }; } },
    '@/lib/supabase/server': { createClient: async () => db }, '@/lib/boards/catalog': { boardCatalog: async () => [] }, '@/lib/boards/layout': layout,
  }) };
}
test('save mirrors linked cards only and preserves full document', async () => {
  const h = actions();
  const snapshot = { store: { card: { id: 'shape:1', typeName: 'shape', type: 'research-record', x: 1, y: 2, rotation: 0.5, index: 'a1', parentId: 'shape:frame', props: { recordKey: 'reference:abc', w: 200, h: 300 } }, sketch: { typeName: 'shape', type: 'draw', props: {} } } };
  assert.equal(await h.api.saveBoard('board', 'old', snapshot), 'next-revision');
  const rpc = h.calls.find(c => c[0] === 'save_research_board')[1];
  assert.equal(rpc.p_snapshot, snapshot); assert.equal(rpc.p_items.length, 1);
  assert.equal(rpc.p_items[0].record_id, 'abc'); assert.equal(rpc.p_items[0].state.parentId, 'shape:frame');
  assert.ok(h.calls.some(c => c[1] === 'owner_id' && c[2] === 'owner'));
});
test('save refuses unauthenticated users, foreign boards, assets and malformed documents', async () => {
  await assert.rejects(actions({ authenticated: false }).api.saveBoard('b', '', {}), /Authentication/);
  await assert.rejects(actions({ owned: false }).api.saveBoard('b', '', {}), /not found/);
  await assert.rejects(actions().api.saveBoard('b', '', {}), /Invalid/);
  await assert.rejects(actions().api.saveBoard('b', '', { store: { asset: { typeName: 'asset' } } }), /embedded assets/);
});
test('optimistic conflict is surfaced, not retried with a newer revision', async () => {
  const h = actions({ conflict: true });
  await assert.rejects(h.api.saveBoard('b', 'old', { store: {} }), /another session/);
  assert.equal(h.calls.filter(c => c[0] === 'save_research_board').length, 1);
});

test('text conversion is retry-safe, keeps note topic context and links references', async () => {
  const tables = { boards: [{ id: 'board', owner_id: 'owner', research_thread_id: 'topic' }], notes: [], references: [], relationships: [] };
  const db = { from(table) {
    const filters = []; let row;
    const q = { select() { return q; }, eq(key, value) { filters.push(r => r[key] === value); return q; }, single() { return q; }, upsert(value) { row = value; return q; }, then(resolve) {
      if (row && !tables[table].some(r => row.id ? r.id === row.id : r.target_id === row.target_id)) tables[table].push(row);
      return Promise.resolve({ data: tables[table].find(r => filters.every(f => f(r))), error: null }).then(resolve);
    } }; return q;
  } };
  const api = load('app/(workspace)/boards/actions.ts', {
    '@/lib/auth': { requireUser: async () => ({ id: 'owner' }) }, '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/boards/layout': layout, '@/lib/boards/catalog': { boardCatalog: async () => [...tables.notes.map(r => record(r.id, 'thinking', { key: `note:${r.id}`, type: 'note' })), ...tables.references.map(r => record(r.id))] },
  });
  await api.convertBoardText('board', 'note-id', 'note', 'Question', 'How does the toolpath carry load?');
  await api.convertBoardText('board', 'note-id', 'note', 'Question', 'How does the toolpath carry load?');
  assert.equal(tables.notes.length, 1); assert.equal(tables.notes[0].parent_id, 'topic'); assert.equal(tables.notes[0].parent_type, 'research_thread');
  await api.convertBoardText('board', 'ref-id', 'reference', 'Study', 'Fabrication study');
  await api.convertBoardText('board', 'ref-id', 'reference', 'Study', 'Fabrication study');
  assert.equal(tables.references.length, 1); assert.equal(tables.relationships.length, 1);
  assert.equal(tables.relationships[0].relationship_type, 'has_reference');
  await assert.rejects(api.convertBoardText('foreign-board', 'n', 'note', 'x', 'x'), /not found/);
  await assert.rejects(api.convertBoardText('board', 'n', 'note', 'x', ''), /text/);
});
const insertion = load('lib/boards/insertion.ts', { tldraw: {
  createShapeId: (() => { let id = 0; return () => `shape:${++id}`; })(),
  loadSnapshot(store, snapshot) { store.loaded = snapshot.document; },
} });
function editorFixture({ readonly = false, reject = false } = {}) {
  const shapes = new Map();
  return { store: {}, shapes, isDisposed: false, getIsReadonly: () => readonly,
    getViewportPageBounds: () => ({ center: { x: 500, y: 400 } }),
    getCurrentPageId: () => 'page:test', getCurrentPageShapes: () => [...shapes.values()],
    getCurrentPageShapeIds: () => new Set(shapes.keys()),
    getShapePageBounds: shape => ({ x: shape.x, y: shape.y }),
    createShape(shape) { if (!reject) shapes.set(shape.id, shape); },
    getShape: id => shapes.get(id), setCurrentTool(tool) { this.tool = tool; },
    select(id) { this.selected = id; }, run(callback) { callback(); },
  };
}
test('all picker types insert visible, selected cards at distinct viewport-centered positions', () => {
  const editor = editorFixture();
  for (const type of ['reference', 'media', 'document', 'note', 'theme', 'project', 'collection']) {
    const item = record(type, 'visual', { type, key: `${type === 'document' ? 'media' : type}:${type}`, subtitle: 'Creator', image: '/boards/thumbnail/image' });
    const id = insertion.insertResearchRecord(editor, item);
    const shape = editor.shapes.get(id);
    assert.equal(shape.props.recordKey, item.key);
    assert.equal(shape.props.recordType, type);
    assert.equal(shape.props.recordId, type);
    assert.equal(shape.props.title, type);
    assert.equal(shape.props.image, '/boards/thumbnail/image');
    assert.equal(shape.parentId, 'page:test');
    assert.equal(shape.props.w, 280); assert.equal(shape.props.h, 300);
    assert.equal(editor.selected, id); assert.equal(editor.tool, 'select');
  }
  const shapes = [...editor.shapes.values()];
  assert.deepEqual([shapes[0].x, shapes[0].y], [360, 250]);
  assert.equal(new Set(shapes.map(s => `${s.x},${s.y}`)).size, 7);
});
test('insertion reports readonly and rejected writes; external image URLs are not copied', () => {
  assert.throws(() => insertion.insertResearchRecord(editorFixture({ readonly: true }), record('a')), /not ready/);
  assert.throws(() => insertion.insertResearchRecord(editorFixture({ reject: true }), record('a')), /could not be added/);
  const editor = editorFixture();
  const id = insertion.insertResearchRecord(editor, record('a', 'visual', { image: 'https://example.com/image.jpg' }));
  assert.equal(editor.shapes.get(id).props.image, undefined);
});
test('seven generated records keep deterministic geometry and initialize only once', () => {
  const records = Array.from({ length: 7 }, (_, i) => record(`${i}`, i < 5 ? 'evidence' : 'visual', i < 5 ? {} : { key: `media:${i}`, type: 'media' }));
  const composition = layout.generateComposition(records, 'research_wall');
  const editor = editorFixture();
  assert.equal(insertion.initializeResearchBoard(editor, null, composition, records), true);
  const cards = [...editor.shapes.values()].filter(s => s.type === 'research-record');
  assert.equal(cards.length, 7);
  for (const [i, card] of cards.entries()) {
    const p = composition.placements[i], frame = editor.shapes.get(card.parentId);
    assert.deepEqual([card.x, card.y, card.props.w, card.props.h], [p.x, p.y, p.w, p.h]);
    assert.equal(frame.x, composition.frames[p.frame].x);
  }
  assert.equal(editor.selected, undefined);
  assert.equal(insertion.initializeResearchBoard(editor, null, composition, records), false);
  assert.equal(editor.shapes.size, 9);
  const reopened = editorFixture(), saved = { store: {}, schema: {} };
  assert.equal(insertion.initializeResearchBoard(reopened, saved, composition, records), false);
  assert.equal(reopened.store.loaded, saved);
  assert.equal(reopened.shapes.size, 0, 'an intentionally empty snapshot must not regenerate');
});
test('missing generated sources fail before any frame is inserted', () => {
  const editor = editorFixture();
  assert.throws(() => insertion.initializeResearchBoard(editor, null, layout.generateComposition([record('gone')], 'research_wall'), []), /unavailable/);
  assert.equal(editor.shapes.size, 0);
});
