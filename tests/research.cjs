/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function harness(ownerId = 'owner') {
  let serial = 0;
  const tables = { research_threads: [{ id: 'topic', owner_id: 'owner', title: 'Topic' }, { id: 'other', owner_id: 'stranger' }], references: [{ id: 'ref', owner_id: 'owner' }, { id: 'foreign-ref', owner_id: 'stranger' }], media: [{ id: 'pdf', owner_id: 'owner', mime_type: 'application/pdf' }], projects: [{ id: 'project', owner_id: 'owner' }], relationships: [], notes: [], tags: [], research_sessions: [{ id: 'session', owner_id: 'owner' }] };
  for (const rows of Object.values(tables)) for (const row of rows) if (row.owner_id === 'owner') row.owner_id = ownerId;
  const storageFiles = new Map();
  const db = { storage: { from: () => ({ download: async key => ({ data: storageFiles.get(key), error: storageFiles.has(key) ? null : { message: 'missing' } }) }) }, from(table) {
    const conditions = [];
    let operation = 'read', payload, options, single = false, optional = false;
    const builder = {
      select() { return builder; }, eq(key, value) { conditions.push(row => row[key] === value); return builder; },
      in(key, values) { conditions.push(row => values.includes(row[key])); return builder; },
      single() { single = true; return builder; }, maybeSingle() { single = true; optional = true; return builder; },
      insert(value) { operation = 'insert'; payload = value; return builder; },
      upsert(value, opts) { operation = 'upsert'; payload = value; options = opts; return builder; },
      update(value) { operation = 'update'; payload = value; return builder; }, delete() { operation = 'delete'; return builder; },
      then(resolve, reject) {
        try {
          const rows = tables[table] ??= [];
          let found = rows.filter(row => conditions.every(check => check(row)));
          if (operation === 'insert' || operation === 'upsert') {
            found = (Array.isArray(payload) ? payload : [payload]).map(value => {
              const existing = operation === 'upsert' && rows.find(row => options.onConflict.split(',').every(key => row[key] === value[key]));
              if (existing) { if (!options.ignoreDuplicates) Object.assign(existing, value); return existing; }
              const added = { id: `new-${++serial}`, metadata: {}, ...value }; rows.push(added); return added;
            });
          } else if (operation === 'update') found.forEach(row => Object.assign(row, payload));
          else if (operation === 'delete') tables[table] = rows.filter(row => !found.includes(row));
          return Promise.resolve({ data: single ? found[0] ?? null : found, error: single && !optional && !found.length ? { message: 'missing' } : null }).then(resolve, reject);
        } catch (error) { return Promise.reject(error).then(resolve, reject); }
      },
    };
    return builder;
  } };
  function load(file) {
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const loaded = { exports: {} };
    const imports = name => {
      if (name === 'next/cache') return { revalidatePath() {} };
      if (name === 'next/navigation') return { redirect(url) { throw new Error(`REDIRECT:${url}`); } };
      if (name === '@/lib/auth') return { requireUser: async () => ({ id: ownerId }), getFormValue: (form, key) => String(form.get(key) ?? '').trim() || null };
      if (name === '@/lib/supabase/server') return { createClient: async () => db };
      if (name === '@/app/(workspace)/discover/actions') return { importDiscover: async () => ({ savedItems: { result: 'ref' } }) };
      if (name.startsWith('@/')) return load(path.resolve(name.slice(2) + '.ts'));
      return require(name);
    };
    new Function('require', 'module', 'exports', code)(imports, loaded, loaded.exports);
    return loaded.exports;
  }
  const { manageTopic } = load('app/(workspace)/research/actions.ts');
  return { tables, storageFiles, load, async act(values, expectError = false) {
    const form = new FormData();
    for (const [key, value] of Object.entries({ topic_id: 'topic', ...values })) form.set(key, value);
    try { await manageTopic(form); assert.fail('Expected redirect'); }
    catch (error) { assert.match(error.message, /^REDIRECT:/); assert.equal(error.message.includes('&error='), expectError, error.message); }
  } };
}

test('create/edit topic and link existing records without duplicating or deleting originals', async () => {
  const h = harness();
  await h.act({ op: 'create', topic_id: '', title: 'New inquiry', status: 'developing' });
  assert.equal(h.tables.research_threads.length, 3);
  await h.act({ op: 'edit', title: 'Edited question', status: 'paused' });
  for (const [type, id] of [['reference', 'ref'], ['media', 'pdf'], ['project', 'project'], ['research_session', 'session']]) await h.act({ op: 'link', record_type: type, record_id: id });
  await h.act({ op: 'link', record_type: 'reference', record_id: 'ref' });
  assert.equal(h.tables.relationships.length, 4);
  await h.act({ op: 'unlink', link_id: h.tables.relationships[0].id });
  assert.equal(h.tables.references.length, 2);
  assert.equal(h.tables.relationships.length, 3);
});
test('review metadata is topic-local and rich note content survives editing', async () => {
  const h = harness();
  await h.act({ op: 'link', record_type: 'reference', record_id: 'ref' });
  await h.act({ op: 'review', link_id: h.tables.relationships[0].id, review_status: 'key_source', key_argument: 'Topic-specific interpretation' });
  assert.equal(h.tables.references[0].key_argument, undefined);
  assert.equal(h.tables.relationships[0].metadata.key_argument, 'Topic-specific interpretation');
  await h.act({ op: 'note', plain_text: 'Draft' });
  h.tables.notes[0].content = [{ futureRichContent: true }];
  await h.act({ op: 'note', note_id: h.tables.notes[0].id, plain_text: 'Edited' });
  assert.deepEqual(h.tables.notes[0].content, [{ futureRichContent: true }]);
  await h.act({ op: 'note-delete', note_id: h.tables.notes[0].id });
  assert.equal(h.tables.notes.length, 0);
});
test('theme membership stays scoped to topic and unlink cleans membership only', async () => {
  const h = harness();
  await h.act({ op: 'theme', title: 'Toolpath control', description: 'Argument' });
  const theme = h.tables.relationships[0];
  await h.act({ op: 'theme-link', theme_id: theme.id, record: 'reference:ref' }, true);
  await h.act({ op: 'link', record_type: 'reference', record_id: 'ref' });
  await h.act({ op: 'theme-link', theme_id: theme.id, record: 'reference:ref' });
  assert.equal(h.tables.relationships.length, 3);
  await h.act({ op: 'unlink', link_id: h.tables.relationships.find(link => link.relationship_type === 'has_reference').id });
  assert.equal(h.tables.relationships.length, 1);
  assert.equal(h.tables.references.length, 2);
});
test('server actions reject foreign owners and prototype record types', async () => {
  const h = harness();
  await h.act({ op: 'edit', topic_id: 'other', title: 'No', status: 'active' }, true);
  await h.act({ op: 'link', record_type: 'reference', record_id: 'foreign-ref' }, true);
  await h.act({ op: 'link', record_type: 'toString', record_id: 'ref' }, true);
  assert.equal(h.tables.relationships.length, 0);
});
test('Discover topic handoff reuses imported references and session links on retry', async () => {
  const h = harness();
  const { addDiscoverToTopic } = h.load('app/(workspace)/research/discover-actions.ts');
  const first = await addDiscoverToTopic('session', ['result'], 'topic', '');
  assert.equal(first.error, undefined);
  await addDiscoverToTopic('session', ['result'], 'topic', '');
  assert.equal(h.tables.relationships.length, 2);
  assert.equal(h.tables.references.length, 2);
  assert.equal(h.tables.relationships[0].relationship_type, 'has_discover_session');
});
test('topic organization preserves other metadata and validates Research Types', async () => {
  const h = harness();
  h.tables.research_threads[0].metadata = { custom: 'retained' };
  await h.act({ op: 'edit', title: 'Plastic extrusion', status: 'active', research_area: 'Additive Manufacturing', research_type: 'Fabrication' });
  assert.deepEqual(h.tables.research_threads[0].metadata, { custom: 'retained', research_area: 'Additive Manufacturing', research_type: 'Fabrication' });
  await h.act({ op: 'edit', title: 'No change', status: 'active', research_type: 'invalid' }, true);
  assert.equal(h.tables.research_threads[0].title, 'Plastic extrusion');
});
test('PDF finalization verifies bytes, reuses retry IDs and links multiple documents', async () => {
  const owner = '00000000-0000-4000-8000-000000000001';
  const topic = '00000000-0000-4000-8000-000000000002';
  const h = harness(owner);
  h.tables.research_threads[0].id = topic;
  const { prepareTopicPdf, finishTopicPdf } = h.load('app/(workspace)/research/pdf-actions.ts');
  for (const ending of ['3', '4']) {
    const id = '00000000-0000-4000-8000-00000000000' + ending;
    const prepared = await prepareTopicPdf(topic, id, 'toolpath-study.pdf');
    assert.ok(prepared.path.startsWith(`${owner}/research/${topic}/`));
    h.storageFiles.set(prepared.path, new Blob(['%PDF-1.7\nfixture'], { type: 'application/pdf' }));
    assert.equal((await finishTopicPdf(topic, id, 'toolpath-study.pdf', '')).id, id);
    assert.equal((await finishTopicPdf(topic, id, 'toolpath-study.pdf', '')).id, id);
  }
  assert.equal(h.tables.media.filter(row => row.bucket === 'research-documents').length, 2);
  assert.equal(h.tables.relationships.length, 2);
  assert.equal(h.tables.media.at(-1).title, 'toolpath study');
  const badId = '00000000-0000-4000-8000-000000000005';
  const prepared = await prepareTopicPdf(topic, badId, 'bad.pdf');
  h.storageFiles.set(prepared.path, new Blob(['not a PDF'], { type: 'application/pdf' }));
  assert.match((await finishTopicPdf(topic, badId, 'bad.pdf', '')).error, /PDF header/);
});
test('PDF filename and size validation; metadata edits do not move topic reviews globally', async () => {
  const h = harness();
  const { pdfValidation, pdfPath, pdfTitle } = h.load('lib/topic-pdf.ts');
  assert.ok(pdfValidation('image/png', 500));
  assert.ok(pdfValidation('application/pdf', 21 * 1024 * 1024));
  assert.throws(() => pdfPath('owner', '../topic', 'id', 'x.pdf'));
  assert.equal(pdfTitle('Robotic_toolpath-study.pdf'), 'Robotic toolpath study');
  await h.act({ op: 'link', record_type: 'media', record_id: 'pdf' });
  const link = h.tables.relationships[0];
  await h.act({ op: 'review', link_id: link.id, review_status: 'included', research_gap: 'Topic-only gap' });
  await h.act({ op: 'document-edit', link_id: link.id, title: 'Updated PDF', document_type: 'paper' });
  assert.equal(h.tables.media[0].title, 'Updated PDF');
  assert.equal(h.tables.media[0].metadata.research_gap, undefined);
  await h.act({ op: 'unlink', link_id: link.id });
  assert.equal(h.tables.media.length, 1);
});
