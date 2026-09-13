/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
// Load the small TypeScript service without adding a test runtime dependency.
function load(file) {
  const filename = path.resolve(file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name.startsWith('.') ? load(path.resolve(path.dirname(filename), name + '.ts')) : require(name), loaded, loaded.exports);
  return loaded.exports;
}
const { normalizeUrl } = load('lib/discover/normalize.ts');
const { searchDiscover } = load('lib/discover/search.ts');
const { BraveSearchProvider } = load('lib/discover/providers/brave.ts');
const { rankDiscoverResults, classifyDiscoverResult, discoverMode } = load('lib/discover/rank.ts');
const { buildDiscoverQuery, discoverFreshness } = load('lib/discover/query.ts');
const { createDiscoverSnapshot } = load('lib/discover/snapshot.ts');
const fixture = (id, title, url, summary = '') => ({ id, title, url, summary, provider: 'fixture', origin: 'external', resultType: 'article' });
const candidates = [
  fixture('project', 'Robotic 3D printed architectural pavilion prototype', 'https://example.com/projects/pavilion', 'Built concrete clay stone and bio-based materials. Robotically fabricated stone architecture stereotomy additive manufacturing. Large-scale pellet extrusion architecture recycled plastic.'),
  fixture('paper', 'Robotic extrusion architecture toolpath research paper', 'https://doi.org/10.123/test', 'Journal proceedings on robotic fabrication, recycled plastic and stone additive manufacturing.'),
  fixture('lab', 'Robotic fabrication architecture laboratory', 'https://research.example.edu/labs/fabrication', 'University research group studying stone, concrete clay and pellet extrusion.'),
  fixture('product', 'Best desktop 3D printers buying guide', 'https://example.com/products/printer', 'Buy now: desktop miniatures and hobby printing.'),
  fixture('vendor', 'Robot equipment manufacturer', 'https://example.com/company', 'Machine sales and equipment catalog for robotic extrusion.'),
  fixture('video', 'Robotic fabrication architecture demonstration', 'https://youtube.com/watch?v=example', 'A pavilion prototype.'),
];
test('classification favors page evidence over incidental snippet words', () => {
  assert.deepEqual(candidates.map(result => classifyDiscoverResult(result).classification), ['project', 'paper', 'lab', 'product', 'vendor', 'video']);
  assert.equal(classifyDiscoverResult(fixture('pdf', 'Equipment brochure', 'https://example.com/catalog/printer.pdf', 'Request a quote')).classification, 'product');
  assert.equal(classifyDiscoverResult(fixture('image', 'Diagram', 'https://example.com/diagram.png')).classification, 'image');
  assert.equal(classifyDiscoverResult(fixture('spoof', 'News', 'https://nature.com.example.org/news')).journal, false);
});
test('A-C: architectural projects outrank generic printer guides', () => {
  for (const query of [
    'robotic 3D printing architecture using concrete clay stone or bio-based materials',
    'robotically fabricated stone architecture stereotomy additive manufacturing',
    'large-scale pellet extrusion architecture recycled plastic',
  ]) {
    const ranked = rankDiscoverResults(candidates, query, 'project');
    assert.equal(ranked[0].id, 'project');
    assert.ok(ranked.findIndex(result => result.id === 'product') > ranked.findIndex(result => result.id === 'lab'));
    assert.deepEqual(ranked, rankDiscoverResults(candidates, query, 'project'));
    const score = ranked[0].metadata;
    assert.equal(score.relevanceScore, Object.values(score.scoreBreakdown).reduce((a, b) => a + b, 0));
  }
});
test('D-E: papers and labs modes reorder the same candidates; videos first', () => {
  assert.equal(rankDiscoverResults(candidates, 'robotic extrusion architecture toolpath', 'paper')[0].id, 'paper');
  assert.equal(rankDiscoverResults(candidates, 'robotic fabrication architecture', 'lab')[0].id, 'lab');
  assert.equal(rankDiscoverResults(candidates, 'robotic fabrication architecture', 'video')[0].id, 'video');
  assert.equal(candidates[0].metadata, undefined);
});
test('query refinement and year ranges preserve the original question and legacy modes', () => {
  const question = 'robotic extrusion architecture toolpath';
  assert.ok(buildDiscoverQuery(question, { contentType: 'paper', topic: '', freshness: '' }).startsWith(question));
  assert.match(buildDiscoverQuery(question, { contentType: 'video', topic: '', freshness: '' }), /site:youtube.com OR site:vimeo.com/);
  assert.equal(discoverFreshness({ yearFrom: '2020', yearTo: '2024', freshness: 'py' }), '2020-01-01to2024-12-31');
  assert.equal(discoverMode('studio'), 'lab');
  assert.equal(discoverMode(''), 'all');
});
test('snapshot excludes raw payloads but retains import IDs, media and scoring', () => {
  const ranked = rankDiscoverResults(candidates, 'robotic fabrication', 'all');
  ranked[0].metadata.rawPayload = { secret: 'not persisted' };
  const snapshot = createDiscoverSnapshot(ranked);
  assert.equal(snapshot[0].id, ranked[0].id);
  assert.equal(snapshot[0].metadata.rawPayload, undefined);
  assert.equal(snapshot[0].metadata.relevanceScore, ranked[0].metadata.relevanceScore);
});
test('canonical URLs retain meaningful parameters and reject unsafe schemes', () => {
  assert.equal(normalizeUrl('https://EXAMPLE.com/work/?utm_source=test&b=2&a=1#photo'), 'https://example.com/work/?a=1&b=2');
  assert.equal(normalizeUrl('https://example.com/'), 'https://example.com');
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'invalid', 'https://user:pass@example.com']) assert.equal(normalizeUrl(url), null);
});
test('validates filters and query before calling provider', async () => {
  const provider = { search: async () => [] };
  await assert.rejects(searchDiscover('', { freshness: '', topic: '', contentType: '' }, provider));
  await assert.rejects(searchDiscover('concrete', { freshness: 'bad', topic: '', contentType: '' }, provider));
  assert.deepEqual(await searchDiscover('concrete', { freshness: '', topic: '', contentType: '' }, provider), []);
});
test('provider normalizes partial results, rejects unsafe links and contains failures', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.BRAVE_SEARCH_API_KEY;
  const filters = { freshness: '', topic: '', contentType: '' };
  try {
    delete process.env.BRAVE_SEARCH_API_KEY;
    await assert.rejects(new BraveSearchProvider().search('clay', filters), /not configured/);
    process.env.BRAVE_SEARCH_API_KEY = 'test-only';
    global.fetch = async () => ({ ok: true, json: async () => ({ web: { results: [
      { title: '<b>Clay</b>', url: 'https://example.com/?utm_source=x' },
      { title: 'Duplicate', url: 'https://example.com/' },
      { title: 'Unsafe', url: 'javascript:alert(1)' }, { title: 'Missing URL' },
    ] } }) });
    const results = await new BraveSearchProvider().search('clay', filters);
    assert.equal(results.length, 1);
    assert.equal(results[0].title, 'Clay');
    assert.equal(results[0].thumbnailUrl, undefined);
    global.fetch = async () => ({ ok: false, status: 429 });
    await assert.rejects(new BraveSearchProvider().search('clay', filters), /busy/);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.BRAVE_SEARCH_API_KEY; else process.env.BRAVE_SEARCH_API_KEY = originalKey;
  }
});
