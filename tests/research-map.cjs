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
const rm = load('lib/research-map.ts');
const { seedMap } = load('lib/research-map-seed.ts', { '@/lib/research-map': rm });
const clone = () => JSON.parse(JSON.stringify(seedMap));
const messages = map => rm.checkMap(map).map(issue => issue.message);

test('the starting map survives a save round trip unchanged', () => {
  assert.deepEqual(rm.parseMap(clone()), seedMap);
  assert.equal(rm.parseMap(null), null);
  assert.equal(rm.parseMap({ items: 'x' }), null);
});

test('parsing drops bad ids, kinds and colours instead of failing', () => {
  const map = clone();
  map.items.push({ id: 'bad id!', name: 'X' });
  map.items[0].kind = 'nonsense';
  map.axes.material.color = 'red; drop';
  const parsed = rm.parseMap(map);
  assert.equal(parsed.items.length, seedMap.items.length);
  assert.equal(parsed.items[0].kind, 'concept');
  assert.equal(parsed.axes.material.color, '#C4572B');
});

test('the starting map only asks for project names', () => {
  const issues = rm.checkMap(seedMap);
  assert.ok(issues.length > 0);
  assert.ok(issues.every(issue => /placeholder|core contribution zone/.test(issue.message)), issues.map(i => i.message).join('\n'));
  const named = clone();
  named.projects = named.projects.map(p => ({ ...p, name: `Project ${p.code}` }));
  assert.deepEqual(messages(named), []);
});

test('checks catch floating items, duplicates, typos and overlaps', () => {
  const map = clone();
  map.items.push({ id: 'z1', name: 'Grasshopper', kind: 'technique', main: false, x: 300, y: 1260, anchor: 'start' });
  map.items.push({ id: 'z2', name: 'Pier Lugi Nervi', kind: 'person', main: false, x: 80, y: 690, anchor: 'start', feeds: { strand: 's5', at: [300, 750], route: 'under' } });
  map.items.push({ id: 'z3', name: 'Scherks Surface', kind: 'concept', main: false, x: 1700, y: 1270, anchor: 'start', feeds: { strand: 's6', at: [2000, 760], route: 'end' } });
  const text = messages(map).join('\n');
  assert.match(text, /“Grasshopper” isn't connected/);
  assert.match(text, /“Grasshopper” appears twice/);
  assert.match(text, /“lugi” is usually spelled “Luigi”/i);
  assert.match(text, /“scherks” is usually spelled “Scherk”/);
  assert.match(text, /overlap/);
  assert.match(text, /look like the same thing/);
});

test('checks catch strands that turn back, bend off-angle or end nowhere', () => {
  const map = clone();
  map.strands[0].points = [[110, 300], [900, 300], [800, 330]];
  const text = messages(map).join('\n');
  assert.match(text, /“Material Systems” turns back right to left/);
  assert.match(text, /“Material Systems” has a bend that isn't at 0°, 45° or 90°/);
  assert.match(text, /“Material Systems” doesn't end at an outcome station/);
});

test('captions and the core zone are checked', () => {
  const map = clone();
  map.caption = 'Used throughtout to postion my work.';
  map.zone = { x: 10, y: 10, w: 50, h: 50, title: 'Core' };
  const text = messages(map).join('\n');
  assert.match(text, /“throughtout” is usually spelled “throughout”/);
  assert.match(text, /“postion” is usually spelled “position”/);
  assert.match(text, /No project sits in the core contribution zone/);
});

test('bends snap to 0°, 45° and 90°', () => {
  assert.deepEqual(rm.snapDirection([100, 100], [203, 107]), [205, 100]);
  assert.deepEqual(rm.snapDirection([100, 100], [180, 172]), [175, 175]);
  assert.deepEqual(rm.snapDirection([100, 100], [104, 40]), [100, 40]);
  assert.ok(rm.segmentAngleOk([0, 0], [100, 100]));
  assert.ok(!rm.segmentAngleOk([0, 0], [100, 60]));
});

test('influences stay attached to the nearest point on their strand', () => {
  const near = rm.nearestOnPolyline([[0, 0], [100, 0], [200, 100]], [150, 20]);
  assert.deepEqual(near.point, [135, 35]);
});

test('the drawing and legend show only what the map uses', () => {
  const svg = rm.renderMapSvg(seedMap);
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg, /HOW TO READ THIS/);
  assert.match(svg, /Pier Luigi Nervi/);
  assert.match(svg, /Project station still to name \(6\)/);
  const bare = clone();
  bare.items = bare.items.filter(item => item.kind !== 'person');
  assert.doesNotMatch(rm.legendSvg(bare), /Person or group/);
  assert.match(rm.legendSvg(seedMap), /Person or group/);
  const escaped = clone(); escaped.title = 'A <b> & C';
  assert.match(rm.renderMapSvg(escaped), /A &lt;B&gt; &amp; C/);
});

test('changes are described in words for the log and comparisons', () => {
  const after = clone();
  after.items[0].name = 'Healthy Material Cultures';
  after.items = after.items.filter(item => item.name !== 'Seaweed');
  after.projects[0].name = 'Limestone Vault';
  after.caption = 'New caption';
  const changes = rm.diffMaps(seedMap, after);
  assert.ok(changes.includes('Renamed “Healthy Materials” to “Healthy Material Cultures”'));
  assert.ok(changes.includes('Removed “Seaweed”'));
  assert.ok(changes.includes('P1 is now “Limestone Vault”'));
  assert.ok(changes.includes('Edited the caption'));
  assert.deepEqual(rm.diffMaps(seedMap, clone()), []);
  const log = rm.appendLog([], changes, '2026-11-10T00:00:00Z');
  assert.equal(log.length, 1);
  assert.equal(rm.appendLog(log, [], 'x'), log);
  assert.deepEqual(rm.parseLog(log), log);
});

test('a dragged bend keeps both of its segments at transit angles', () => {
  const p = rm.snapBetween([0, 0], [300, 100], [180, 20]);
  assert.ok(rm.segmentAngleOk([0, 0], p) && rm.segmentAngleOk(p, [300, 100]), String(p));
  assert.deepEqual(p, [200, 0]);
});

test('styles survive a save, bad values fall back, and presets draw their patterns', () => {
  const map = clone();
  assert.equal(rm.renderMapSvg(map).includes('url(#rm-zone-stripes)'), false);
  const ledger = rm.stylePresets.find(p => p.key === 'ledger');
  map.style = ledger.style;
  map.stylePresets = [{ name: 'Review', style: ledger.style }];
  const back = rm.parseMap(JSON.parse(JSON.stringify(map)));
  assert.deepEqual(back.style, ledger.style);
  assert.equal(back.stylePresets[0].name, 'Review');
  const svg = rm.renderMapSvg(back);
  assert.ok(svg.includes('url(#rm-zone-stripes)') && svg.includes('url(#rm-stripes)') && svg.includes(ledger.style.background));
  const bad = rm.parseStyle({ strandWidth: 900, font: 'comic', ink: 'red', construction: 'yes' });
  assert.equal(bad.strandWidth, 16); assert.equal(bad.font, 'helvetica'); assert.equal(bad.ink, rm.defaultStyle.ink); assert.equal(bad.construction, false);
  assert.ok(rm.diffMaps(clone(), back).includes('Changed the style'));
  for (const preset of rm.stylePresets) { const m = clone(); m.style = preset.style; assert.deepEqual(messages(m).filter(t => !/placeholder/.test(t)), [], preset.key); }
});

test('shapes and per-station paint survive a save and draw as set', () => {
  const map = clone();
  map.style = { ...rm.defaultStyle, planes: true };
  assert.equal(rm.shapesOf(map).length, 3);
  map.shapes = rm.shapesOf(map).map((sh, i) => i === 0 ? { ...sh, fill: '#112233', hatch: 'chevrons' } : i === 1 ? { ...sh, hidden: true } : sh);
  map.shapes.push({ id: 'shape1', name: 'Circle', kind: 'ellipse', points: [[100, 300], [300, 500]], fill: '#F2A890', opacity: 0.4, hatch: 'none', stroke: '#141414', strokeWidth: 2, outline: 'dashed', front: true });
  const inter = map.items.find(item => item.marker?.type === 'interchange');
  inter.marker.paint = { fill: 'stripes', stroke: '#aa0000', scale: 1.5, bogus: 1 };
  const back = rm.parseMap(JSON.parse(JSON.stringify(map)));
  assert.equal(back.shapes.length, 4);
  assert.deepEqual(back.items.find(i => i.id === inter.id).marker.paint, { fill: 'stripes', stroke: '#aa0000', scale: 1.5 });
  const svg = rm.renderMapSvg(back);
  assert.ok(svg.includes('fill="#112233"') && svg.includes('url(#rm-zone-chevrons)') && svg.includes('<ellipse cx="200" cy="400"'));
  assert.ok(svg.includes(`rm-stripes-${inter.id}`));
  assert.equal(svg.includes(`fill="${map.shapes[1].fill}" fill-opacity="0.09"`), false, 'hidden plane is not drawn');
  const before = rm.parseMap(JSON.parse(JSON.stringify(map))); back.shapes = back.shapes.slice(1);
  assert.ok(rm.diffMaps(before, back).some(c => /^Removed the shape/.test(c)));
  assert.deepEqual(rm.parseMap({ ...clone(), shapes: [] }).shapes, []);
  assert.equal(rm.renderMapSvg({ ...clone(), style: { ...rm.defaultStyle, planes: true }, shapes: [] }).includes('fill-opacity="0.09"'), false, 'an empty shape list means the planes were deleted');
});
