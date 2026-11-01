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
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const organization = load('lib/boards/organization.ts');

test('boards group as loose ideas first, then by project', () => {
  const projects = [{ id: 'p-a', title: 'Alpha' }, { id: 'p-b', title: 'Beta' }];
  const groups = organization.groupBoards([{ id: '1', project_id: 'p-b' }, { id: '2', project_id: null }, { id: '3', project_id: 'p-a' }, { id: '4', project_id: 'gone' }], projects);
  assert.deepEqual(groups.map(g => g.title), ['Loose ideas', 'Alpha', 'Beta', 'Other boards']);
  assert.deepEqual(organization.groupBoards([], projects), []);
});

test('a board carries its original topic plus every tagged topic', () => {
  const links = [{ source_id: 't2', target_id: 'b' }, { source_id: 't1', target_id: 'b' }, { source_id: 't3', target_id: 'other' }];
  assert.deepEqual(organization.boardTopicIds({ id: 'b', research_thread_id: 't1' }, links), ['t1', 't2']);
  assert.deepEqual(organization.boardTopicIds({ id: 'b', research_thread_id: null }, []), []);
});

function harness({ foreignProject = false } = {}) {
  const tables = {
    boards: [{ id: uuid(1), owner_id: 'owner', project_id: null, research_thread_id: uuid(20), updated_at: 'r1' }],
    projects: foreignProject ? [] : [{ id: uuid(10), owner_id: 'owner' }],
    research_threads: [uuid(20), uuid(21), uuid(22)].map(id => ({ id, owner_id: 'owner' })),
    relationships: [{ owner_id: 'owner', source_type: 'research_thread', source_id: uuid(21), relationship_type: 'has_board', target_type: 'board', target_id: uuid(1) }],
  };
  const revalidated = [];
  const db = { from(table) {
    const filters = []; let op = 'select', patch;
    const q = {
      select() { return q; }, eq(k, v) { filters.push(r => r[k] === v); return q; }, in(k, vs) { filters.push(r => vs.includes(r[k])); return q; },
      single() { q.one = true; return q; }, update(v) { op = 'update'; patch = v; return q; }, delete() { op = 'delete'; return q; },
      upsert(rows) { for (const row of rows) if (!tables[table].some(r => r.source_id === row.source_id && r.target_id === row.target_id && r.relationship_type === row.relationship_type)) tables[table].push(row); return Promise.resolve({ error: null }); },
      insert(row) { const created = { id: uuid(2), updated_at: 'r1', ...row }; tables[table].push(created); filters.push(r => r === created); return q; },
      then(resolve) {
        const rows = tables[table].filter(r => filters.every(f => f(r)));
        if (op === 'delete') tables[table] = tables[table].filter(r => !rows.includes(r));
        if (op === 'update') rows.forEach(r => Object.assign(r, patch, { updated_at: 'r2' }));
        return Promise.resolve({ data: q.one ? rows[0] ?? null : rows, error: null }).then(resolve);
      },
    };
    return q;
  } };
  const api = load('app/(workspace)/boards/organize-actions.ts', {
    'next/navigation': { redirect: url => { throw Object.assign(new Error('redirect'), { url }); } },
    'next/cache': { revalidatePath: path => revalidated.push(path) },
    '@/lib/auth': { requireUser: async () => ({ id: 'owner' }) }, '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/boards/organization': organization,
  });
  return { api, tables, revalidated };
}

test('moving a board into a project and retagging topics keeps one original topic', async () => {
  const h = harness();
  const result = await h.api.organizeBoard(uuid(1), uuid(10), [uuid(22), uuid(20)], 'r1');
  assert.equal(result.revision, 'r2');
  assert.equal(h.tables.boards[0].project_id, uuid(10));
  assert.equal(h.tables.boards[0].research_thread_id, uuid(20), 'original topic kept while still chosen');
  assert.deepEqual(h.tables.relationships.map(r => r.source_id), [uuid(22)], 'untagged topic removed, new topic linked');
  assert.ok(h.revalidated.includes(`/projects/${uuid(10)}`));
  const loose = await h.api.organizeBoard(uuid(1), null, [], 'r2');
  assert.equal(h.tables.boards[0].project_id, null); assert.equal(h.tables.boards[0].research_thread_id, null);
  assert.deepEqual(loose.topicIds, []); assert.equal(h.tables.relationships.length, 0);
});

test('organizing refuses stale revisions and projects owned by someone else', async () => {
  await assert.rejects(harness().api.organizeBoard(uuid(1), uuid(10), [], 'stale'), /Reload/);
  await assert.rejects(harness({ foreignProject: true }).api.organizeBoard(uuid(1), uuid(10), [], 'r1'), /project is unavailable/);
});

test('a new board can start loose or inside a project with topics', async () => {
  const h = harness(); const form = new FormData();
  form.set('title', 'Fabrication sketches'); form.set('project_id', uuid(10)); form.append('topic_id', uuid(21)); form.append('topic_id', uuid(22));
  await assert.rejects(h.api.createBoard(form), e => e.url === `/boards/${uuid(2)}`);
  const board = h.tables.boards.find(b => b.id === uuid(2));
  assert.equal(board.project_id, uuid(10)); assert.equal(board.research_thread_id, uuid(21));
  assert.ok(h.tables.relationships.some(r => r.source_id === uuid(22) && r.target_id === uuid(2)));
  const loose = new FormData(); loose.set('title', 'Loose'); loose.set('project_id', '');
  const h2 = harness(); await assert.rejects(h2.api.createBoard(loose), e => !!e.url);
  assert.equal(h2.tables.boards.at(-1).project_id, null);
});
