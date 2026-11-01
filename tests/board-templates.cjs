/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync('lib/boards/templates.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(() => { throw new Error('no imports'); }, mod, mod.exports);
const t = mod.exports;
const COLORS = ['black', 'grey', 'light-violet', 'violet', 'blue', 'light-blue', 'yellow', 'orange', 'green', 'light-green', 'light-red', 'red', 'white'];

test('every template has a unique id, a known group and valid references', () => {
  const ids = new Set();
  for (const tpl of t.TEMPLATES) {
    assert.ok(!ids.has(tpl.id), tpl.id); ids.add(tpl.id);
    assert.ok(t.TEMPLATE_GROUPS.includes(tpl.group), tpl.id);
    const frames = new Set(tpl.pieces.filter(p => p.kind === 'frame').map(p => p.ref));
    const boxes = new Set(tpl.pieces.filter(p => p.kind === 'box').map(p => p.ref));
    for (const p of tpl.pieces) {
      if (p.parent) assert.ok(frames.has(p.parent), `${tpl.id}: parent ${p.parent}`);
      if (p.kind === 'connect') assert.ok(boxes.has(p.from) && boxes.has(p.to), `${tpl.id}: connect ${p.from}->${p.to}`);
      if (p.color) assert.ok(COLORS.includes(p.color), `${tpl.id}: colour ${p.color}`);
      if ('w' in p) assert.ok(p.w > 0 && (p.kind === 'text' || p.h > 0), `${tpl.id}: size`);
    }
  }
  for (const group of t.TEMPLATE_GROUPS) assert.ok(t.TEMPLATES.some(x => x.group === group), group);
});

test('children sit inside their frame', () => {
  for (const tpl of t.TEMPLATES) {
    const frames = new Map(tpl.pieces.filter(p => p.kind === 'frame').map(p => [p.ref, p]));
    for (const p of tpl.pieces) {
      if (!p.parent || p.kind === 'text' || p.kind === 'note') continue;
      const f = frames.get(p.parent);
      assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= f.w + 0.5 && p.y + p.h <= f.h + 0.5, `${tpl.id}: ${p.kind} ${p.label || ''}`);
    }
  }
});

test('slide layouts are one 16:9 slide; decks are slides in a row', () => {
  for (const tpl of t.TEMPLATES.filter(x => x.group === 'Slide layouts')) {
    const frames = tpl.pieces.filter(p => p.kind === 'frame');
    assert.equal(frames.length, 1); assert.equal(frames[0].slide, true);
    assert.deepEqual([frames[0].w, frames[0].h], [1280, 720]);
  }
  const deck = t.TEMPLATES.find(x => x.id === 'deck-portfolio');
  const slides = deck.pieces.filter(p => p.kind === 'frame');
  assert.deepEqual(slides.map(s => s.name), ['Cover', 'Project overview', 'Process', 'Outcome', 'Reflection']);
  assert.ok(slides.every((s, i) => s.y === 0 && s.x === i * 1440));
});

test('starter-board zones stay off the slide deck', () => {
  const kanban = t.TEMPLATES.find(x => x.id === 'start-kanban');
  const zones = kanban.pieces.filter(p => p.kind === 'frame');
  assert.deepEqual(zones.map(z => z.name), ['To do', 'Doing', 'Review', 'Done']);
  assert.ok(zones.every(z => !z.slide));
});

test('bounds and placement centre a template in view, or follow the last slide', () => {
  const pieces = [{ kind: 'frame', ref: 'a', x: 0, y: 0, w: 100, h: 50, name: 'A' }, { kind: 'shape', x: 200, y: -20, w: 50, h: 50, geo: 'rectangle' }, { kind: 'text', parent: 'a', x: 500, y: 500, w: 900, text: 'x', size: 's' }];
  const b = t.templateBounds(pieces);
  assert.deepEqual(b, { x: 0, y: -20, w: 250, h: 70 });
  assert.deepEqual(t.templateOrigin(b, { x: 1000, y: 1000 }), { x: 875, y: 985 });
  assert.deepEqual(t.templateOrigin(b, { x: 1000, y: 1000 }, { x: 3000, y: 40 }), { x: 3000, y: 60 });
});

test('saved templates leave out research cards, images, Theme frames and what is inside them', () => {
  const content = {
    shapes: [
      { id: 'shape:f', type: 'frame', parentId: 'page:1', meta: { slideIndex: 3, slideNotes: 'keep' }, props: {} },
      { id: 'shape:card', type: 'research-record', parentId: 'shape:f', meta: {}, props: {} },
      { id: 'shape:note', type: 'note', parentId: 'shape:f', meta: {}, props: {} },
      { id: 'shape:theme', type: 'frame', parentId: 'page:1', meta: { recordKey: 'theme:1' }, props: {} },
      { id: 'shape:inTheme', type: 'geo', parentId: 'shape:theme', meta: {}, props: {} },
      { id: 'shape:img', type: 'image', parentId: 'page:1', meta: {}, props: {} },
      { id: 'shape:arrow', type: 'arrow', parentId: 'page:1', meta: {}, props: {} },
    ],
    bindings: [{ fromId: 'shape:arrow', toId: 'shape:note' }, { fromId: 'shape:arrow', toId: 'shape:card' }],
    rootShapeIds: ['shape:f', 'shape:theme', 'shape:img', 'shape:arrow'],
    assets: [{ id: 'asset:1' }],
  };
  const out = t.stripForTemplate(content);
  assert.deepEqual(out.content.shapes.map(s => s.id), ['shape:f', 'shape:note', 'shape:arrow']);
  assert.deepEqual(out.content.rootShapeIds, ['shape:f', 'shape:arrow']);
  assert.deepEqual(out.content.bindings, [{ fromId: 'shape:arrow', toId: 'shape:note' }]);
  assert.deepEqual(out.content.assets, []);
  assert.deepEqual(out.content.shapes[0].meta, { slideNotes: 'keep' });
  assert.equal(out.kept, 3); assert.equal(out.left, 4);
  assert.equal(content.shapes[0].meta.slideIndex, 3, 'input is not mutated');
});

test('saved list parsing ignores junk', () => {
  assert.deepEqual(t.parseSaved(null), []);
  assert.deepEqual(t.parseSaved('{bad'), []);
  assert.deepEqual(t.parseSaved('{"a":1}'), []);
  const ok = { id: '1', name: 'Mine', created: '2026-11-01', content: { shapes: [] }, count: 1 };
  assert.deepEqual(t.parseSaved(JSON.stringify([ok, { id: 2 }, null])), [ok]);
});

test('a template whose spot is taken starts below existing work instead of on top of it', () => {
  const b = { x: 0, y: 0, w: 100, h: 100 };
  assert.deepEqual(t.clearOrigin(b, { x: 500, y: 500 }, [{ x: 0, y: 0, w: 50, h: 50 }]), { x: 500, y: 500 });
  assert.deepEqual(t.clearOrigin(b, { x: 0, y: 0 }, [{ x: -40, y: 10, w: 300, h: 200 }, { x: 600, y: 900, w: 10, h: 10 }]), { x: -40, y: 1150 });
});
