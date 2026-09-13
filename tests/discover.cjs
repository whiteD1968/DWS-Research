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
