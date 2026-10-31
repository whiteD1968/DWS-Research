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
const p = load('lib/pinterest.ts');

test('the sign-in link asks only to read boards, pins, and the account', () => {
  const url = new URL(p.authorizeUrl('123', 'https://site.example/api/pinterest/callback', 'abc'));
  assert.equal(url.origin + url.pathname, 'https://www.pinterest.com/oauth/');
  assert.equal(url.searchParams.get('client_id'), '123');
  assert.equal(url.searchParams.get('state'), 'abc');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.ok(url.searchParams.get('scope').split(',').every(scope => scope.endsWith(':read') || scope.endsWith(':read_secret')));
});
test('tokens are stored with an early expiry and keep the old refresh token when none comes back', () => {
  const saved = p.tokenSettings({ access_token: 'a', expires_in: 3600 }, 1000, 'old');
  assert.equal(saved.refresh_token, 'old');
  assert.equal(saved.expires_at, 1000 + 3540 * 1000);
  assert.equal(p.tokenSettings({}), null);
  assert.deepEqual(p.pinterestSettingsFrom({ access_token: 'a', expires_at: 5, username: 'dw' }), { accessToken: 'a', refreshToken: '', expiresAt: 5, refreshExpiresAt: 0, username: 'dw' });
});
test('the largest image wins, carousels use their first slide, and non-https links are ignored', () => {
  assert.equal(p.bestImage({ id: '1', media: { images: { '150x150': { url: 'https://i/150', width: 150 }, '1200x': { url: 'https://i/1200', width: 1200 }, '600x': { url: 'https://i/600', width: 600 } } } }).url, 'https://i/1200');
  assert.equal(p.bestImage({ id: '1', media: { images: { '600x': { url: 'https://i/600', width: 600 }, originals: { url: 'https://i/o', width: 500 } } } }).url, 'https://i/o');
  assert.equal(p.bestImage({ id: '1', media: { items: [{ images: { '600x': { url: 'https://i/c', width: 600 } } }] } }).url, 'https://i/c');
  assert.equal(p.bestImage({ id: '1', media: { images: { '600x': { url: 'http://i/x', width: 600 } } } }), null);
});
test('a pin keeps its link, board, and section, and a pin without a title gets a file name for Describe to replace', () => {
  const record = p.pinRecord({ id: '99', title: '', description: ' Steel  canopy ', link: 'https://maker.example/work' }, { id: 'b1', name: 'Canopies' }, 'Tensile');
  assert.equal(record.title, 'pinterest-99');
  assert.equal(record.metadata.pinterest.board, 'Canopies');
  assert.equal(record.metadata.pinterest.section, 'Tensile');
  assert.equal(record.metadata.pinterest.description, 'Steel canopy');
  assert.equal(record.metadata.pinterest.url, 'https://www.pinterest.com/pin/99/');
  assert.equal(p.pinRecord({ id: '5', title: 'Glass house' }, { id: 'b', name: 'B' }).title, 'Glass house');
  assert.equal(p.extensionFor('image/jpeg'), 'jpg');
  assert.equal(p.extensionFor('image/tiff'), '');
});
