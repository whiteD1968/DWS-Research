/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = {};
function load(file) {
  const filename = path.resolve(file);
  if (cache[filename]) return cache[filename].exports;
  const mod = { exports: {} }; cache[filename] = mod;
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name.startsWith('@/lib/') ? load(`lib/${name.slice(6)}.ts`) : name.startsWith('.') ? load(path.resolve(path.dirname(filename), name + '.ts')) : require(name), mod, mod.exports);
  return mod.exports;
}
const c = load('lib/citation.ts');
const { openAlexResult, openAlexAbstract } = load('lib/discover/providers/openalex.ts');
const { openLibraryResult } = load('lib/discover/providers/openlibrary.ts');
const { commonsResult } = load('lib/discover/providers/commons.ts');
const { articResult } = load('lib/discover/providers/artic.ts');
const { interleave, searchImages } = load('lib/discover/providers/router.ts');
const { createDiscoverSnapshot } = load('lib/discover/snapshot.ts');
const { searchDiscover } = load('lib/discover/search.ts');
const { discoverFamily, rankDiscoverResults } = load('lib/discover/rank.ts');
const z = load('lib/zotero.ts');
const apa = data => c.citationText(c.formatApa(data));

test('author lists follow APA 7 (one, two, many, 21+, group)', () => {
  const n = c.parsePersonName;
  assert.deepEqual(n('Jane Q. Doe'), { family: 'Doe', given: 'Jane Q.' });
  assert.deepEqual(n('Ludwig Mies van der Rohe'), { family: 'van der Rohe', given: 'Ludwig Mies' });
  assert.deepEqual(n('Doe, Jane'), { family: 'Doe', given: 'Jane' });
  assert.equal(c.formatApaAuthors([n('Jane Q. Doe')]), 'Doe, J. Q.');
  assert.equal(c.formatApaAuthors([n('Jane Doe'), n('Jean-Paul Smith')]), 'Doe, J., & Smith, J.-P.');
  const many = Array.from({ length: 22 }, (_, i) => ({ family: `A${i}`, given: 'B' }));
  assert.match(c.formatApaAuthors(many), /^A0, B\., .*A18, B\., \. \. \. A21, B\.$/);
  assert.equal(c.formatApaAuthors([{ literal: 'Foster + Partners' }]), 'Foster + Partners');
  assert.deepEqual(c.parseCreatorLabel('Ana Ruiz, Ben Ode, and Cy Pratt').map(x => x.family), ['Ruiz', 'Ode', 'Pratt']);
  assert.deepEqual(c.parseCreatorLabel('Ana Ruiz and Ben Ode').map(x => x.family), ['Ruiz', 'Ode']);
});

test('journal article, book, chapter, web page, image and artwork formats', () => {
  assert.equal(apa({ kind: 'journal-article', authors: [{ family: 'Doe', given: 'Jane' }, { family: 'Roe', given: 'Rick' }], title: 'Robotic stone carving', year: '2021',
    containerTitle: 'Automation in Construction', volume: '12', issue: '3', pages: '45–67', doi: '10.1016/j.autcon.2021.1' }),
    'Doe, J., & Roe, R. (2021). Robotic stone carving. Automation in Construction, 12(3), 45–67. https://doi.org/10.1016/j.autcon.2021.1');
  const parts = c.formatApa({ kind: 'journal-article', authors: [{ family: 'Doe', given: 'Jane' }], title: 'T', year: '2021', containerTitle: 'J', volume: '1', issue: '2' });
  assert.deepEqual(parts.filter(p => p.italic).map(p => p.text), ['J, 1']);
  assert.equal(apa({ kind: 'book', authors: [{ family: 'Frampton', given: 'Kenneth' }], title: 'Studies in tectonic culture', year: '1995', publisher: 'MIT Press', edition: '2nd' }),
    'Frampton, K. (1995). Studies in tectonic culture (2nd ed.). MIT Press.');
  assert.equal(c.citationHtml(c.formatApa({ kind: 'book', title: 'Fish & chips "x"', year: '2000' })), '<i>Fish &amp; chips &quot;x&quot;</i>. (2000).');
  assert.equal(apa({ kind: 'book-chapter', authors: [{ family: 'Lee', given: 'Ann' }], title: 'Vaults', year: '2010', containerTitle: 'Gothic structure', pages: '1–20', publisher: 'Yale University Press' }),
    'Lee, A. (2010). Vaults. In Gothic structure (pp. 1–20). Yale University Press.');
  assert.equal(apa({ kind: 'webpage', title: 'Clay printing pavilion', year: '2023', month: 5, day: 4, siteName: 'ArchDaily', url: 'https://archdaily.com/x' }),
    'Clay printing pavilion. (2023, May 4). ArchDaily. https://archdaily.com/x');
  assert.equal(apa({ kind: 'webpage', title: 'Lab page', siteName: 'example.edu', url: 'https://example.edu/lab', accessed: '2026-11-07T10:00:00Z' }),
    'Lab page. (n.d.). example.edu. Retrieved November 7, 2026, from https://example.edu/lab');
  assert.equal(apa({ kind: 'artwork', authors: [{ family: 'Monet', given: 'Claude' }], title: 'Water Lilies', year: '1906', description: 'Painting', siteName: 'Art Institute of Chicago', place: 'Chicago, IL, United States', url: 'https://www.artic.edu/artworks/16568' }),
    'Monet, C. (1906). Water Lilies [Painting]. Art Institute of Chicago, Chicago, IL, United States. https://www.artic.edu/artworks/16568');
  assert.equal(apa({ kind: 'image', title: 'Chartres nave', description: 'Photograph', siteName: 'Wikimedia Commons', url: 'https://commons.wikimedia.org/wiki/File:X.jpg' }),
    'Chartres nave [Photograph]. (n.d.). Wikimedia Commons. https://commons.wikimedia.org/wiki/File:X.jpg');
  assert.equal(apa({ kind: 'journal-article', title: 'Why vaults?', year: '2001' }), 'Why vaults? (2001).');
});

test('OpenAlex records map to citable papers', () => {
  assert.equal(openAlexAbstract({ stone: [1], Robotic: [0], carving: [2] }), 'Robotic stone carving');
  const r = openAlexResult({ id: 'https://openalex.org/W1', doi: 'https://doi.org/10.1/abc', display_name: 'Robotic <i>stone</i> carving', publication_year: 2021, publication_date: '2021-03-02', type: 'article',
    authorships: [{ author: { display_name: 'Jane Doe' } }, { author: { display_name: 'Rick Roe' } }],
    primary_location: { source: { display_name: 'Automation in Construction' } }, biblio: { volume: '12', issue: '3', first_page: '45', last_page: '67' } }, 1);
  assert.equal(r.resultType, 'paper');
  assert.equal(r.url, 'https://doi.org/10.1/abc');
  assert.equal(apa(r.metadata.citation), 'Doe, J., & Roe, R. (2021). Robotic stone carving. Automation in Construction, 12(3), 45–67. https://doi.org/10.1/abc');
  assert.equal(openAlexResult({ id: 'x' }, 1), null);
  assert.equal(openAlexResult({ id: 'https://openalex.org/W2', display_name: 'A book', type: 'book', primary_location: { source: { display_name: 'Routledge', host_organization_name: 'Taylor & Francis' } } }, 1).resultType, 'book');
});

test('Open Library, Commons and Art Institute records map to books and images', () => {
  const book = openLibraryResult({ key: '/works/OL123W', title: 'The Gothic cathedral', author_name: ['Otto von Simson'], first_publish_year: 1956, publisher: ['Pantheon Books'], cover_i: 42 }, 1);
  assert.equal(book.resultType, 'book');
  assert.equal(book.thumbnailUrl, 'https://covers.openlibrary.org/b/id/42-M.jpg');
  assert.equal(apa(book.metadata.citation), 'von Simson, O. (1956). The Gothic cathedral. Pantheon Books.');
  assert.equal(openLibraryResult({ key: '/authors/OL1A', title: 'x' }, 1), null);
  const image = commonsResult({ title: 'File:Chartres_nave.jpg', imageinfo: [{ url: 'https://upload.wikimedia.org/a.jpg', thumburl: 'https://upload.wikimedia.org/t.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Chartres_nave.jpg', mime: 'image/jpeg', width: 4000, height: 3000,
    extmetadata: { Artist: { value: '<a href="//x">Jane Doe</a>' }, DateTimeOriginal: { value: '2015-06-03 10:00' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }] }, 1);
  assert.equal(image.sourcePageUrl, 'https://commons.wikimedia.org/wiki/File:Chartres_nave.jpg');
  assert.equal(apa(image.metadata.citation), 'Doe, J. (2015). Chartres nave [Photograph]. Wikimedia Commons. https://commons.wikimedia.org/wiki/File:Chartres_nave.jpg');
  assert.equal(commonsResult({ title: 'File:a.pdf', imageinfo: [{ url: 'https://u/a.pdf', descriptionurl: 'https://c/a', mime: 'application/pdf' }] }, 1), null);
  const art = articResult({ id: 16568, title: 'Water Lilies', artist_title: 'Claude Monet', date_display: '1906', image_id: '3c27b499-af56-f0d5-93b5-a7f2f1ad5813', artwork_type_title: 'Painting', thumbnail: { width: 900, height: 600 } }, 1);
  assert.equal(art.imageUrl, 'https://www.artic.edu/iiif/2/3c27b499-af56-f0d5-93b5-a7f2f1ad5813/full/843,/0/default.jpg');
  assert.match(apa(art.metadata.citation), /^Monet, C\. \(1906\)\. Water Lilies \[Painting\]\. Art Institute of Chicago/);
  assert.equal(articResult({ id: 1, image_id: 'bad id' }, 1), null);
  assert.equal(articResult({ id: 1, image_id: '3c27b499-af56', title: 'x' }, 1, 'https://evil.example/x'), null);
});

test('snapshots keep citation data and saved references cite from it', () => {
  const r = openLibraryResult({ key: '/works/OL1W', title: 'Gothic architecture', author_name: ['Paul Frankl'], first_publish_year: 1962, publisher: ['Penguin'] }, 1);
  const [snap] = createDiscoverSnapshot(rankDiscoverResults([r], 'gothic architecture', 'book'));
  assert.equal(snap.resultType, 'book');
  assert.ok(snap.metadata.citation);
  const reference = { title: snap.title, reference_type: 'book', creator: snap.creator, reference_date: snap.publishedAt, metadata: { external_result: snap } };
  assert.equal(c.citationText(c.referenceCitation(reference, { url: snap.url }).parts), 'Frankl, P. (1962). Gothic architecture. Penguin.');
  // Owner edits to creator/date after saving win over the provider record.
  assert.equal(c.citationText(c.referenceCitation({ ...reference, creator: 'Paul Crossley', reference_date: '2000' }).parts), 'Crossley, P. (2000). Gothic architecture. Penguin.');
  // A hand-edited citation is kept verbatim.
  const edited = c.referenceCitation({ ...reference, metadata: { ...reference.metadata, apa_citation: { text: 'My text.', edited: true } } });
  assert.deepEqual(edited, { parts: [{ text: 'My text.' }], edited: true });
  // Web result without structured data falls back to a dated web page citation.
  assert.equal(c.citationText(c.citationFromResult ? c.formatApa(c.citationFromResult({ title: 'Clay pavilion', resultType: 'project', url: 'https://www.archdaily.com/1', sourceName: 'ArchDaily', publishedAt: '2023-05-04T00:00:00' })) : []),
    'Clay pavilion. (2023, May 4). ArchDaily. https://www.archdaily.com/1');
  // Brave image results cite the page that published the image.
  assert.match(c.citationText(c.formatApa(c.citationFromResult({ title: 'Vault', resultType: 'image', url: 'https://cdn.x/v.jpg', sourcePageUrl: 'https://site.org/page', sourceName: 'site.org' }))), /\[Image\]\. \(n\.d\.\)\. site\.org\. https:\/\/site\.org\/page$/);
});

test('Zotero items carry structured names and a stored APA citation', () => {
  const r = z.zoteroRecord({ key: 'ABCD1234', version: 3, data: { key: 'ABCD1234', itemType: 'journalArticle', title: 'Ribbed vaults', date: '2019-05', DOI: '10.5/x',
    publicationTitle: 'Journal of Architecture', volume: '24', issue: '2', pages: '100-120', creators: [{ creatorType: 'author', firstName: 'Ana', lastName: 'Ruiz' }, { creatorType: 'editor', firstName: 'E', lastName: 'Ed' }] } });
  assert.deepEqual(r.reference.metadata.zotero.creators, [{ family: 'Ruiz', given: 'Ana' }]);
  assert.equal(r.reference.metadata.apa_citation.text, 'Ruiz, A. (2019). Ribbed vaults. Journal of Architecture, 24(2), 100-120. https://doi.org/10.5/x');
  assert.equal(r.reference.metadata.apa_citation.style, 'apa7');
});

test('new modes route, validate and keep their families apart', async () => {
  assert.equal(discoverFamily('scholarly'), 'scholarly');
  assert.equal(discoverFamily('book'), 'book');
  assert.equal(discoverFamily('paper'), 'web');
  assert.equal(discoverFamily('image'), 'image');
  const fixed = { search: async () => [openLibraryResult({ key: '/works/OL9W', title: 'Old stones', first_publish_year: 1880 }, 1)] };
  const results = await searchDiscover('stones', { contentType: 'book', freshness: '', topic: '', yearFrom: '1850' }, fixed);
  assert.equal(results[0].resultType, 'book');
  await assert.rejects(searchDiscover('stones', { contentType: 'book', freshness: 'py', topic: '' }, fixed), /From year/);
  await assert.rejects(searchDiscover('stones', { contentType: 'project', freshness: '', topic: '', yearFrom: '1850' }, fixed), /between 1900/);
});

test('image search merges open collections and survives a failing provider', async () => {
  const img = (id, url) => ({ id, url, title: id, provider: 'f', origin: 'external', resultType: 'image' });
  assert.deepEqual(interleave([[img('a1', 'u1'), img('a2', 'u2')], [img('b1', 'u3'), img('dup', 'u1')]]).map(r => r.id), ['a1', 'b1', 'a2']);
  const ok = { search: async () => [img('c', 'u9')] };
  const bad = { search: async () => { throw new Error('Image search is not enabled'); } };
  assert.deepEqual((await searchImages('q', {}, [bad, ok])).map(r => r.id), ['c']);
  await assert.rejects(searchImages('q', {}, [bad, bad]), /not enabled/);
});
