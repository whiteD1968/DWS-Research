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
const drafts = load('lib/boards/drafts.ts');
function storage() {
  const rows = new Map();
  return { rows, async write(d) { rows.set(d.id, d); }, async remove(d) { if (rows.get(d.id)?.savedAt === d.savedAt) rows.delete(d.id); } };
}
test('acknowledging an older save retains newer edits with the new server revision', async () => {
  const disk = storage(); const j = new drafts.DraftJournal('owner', 'board', 'tab1', () => assert.fail('disk failure'), disk);
  const a = { store: { a: 1 } }, b = { store: { a: 2 } };
  j.write(a, 'r1'); j.write(b, 'r1'); j.acknowledge(a, 'r2'); await j.settled();
  assert.equal(disk.rows.get('tab1').snapshot, b); assert.equal(disk.rows.get('tab1').revision, 'r2');
  j.acknowledge(b, 'r3'); await j.settled(); assert.equal(disk.rows.size, 0);
});
test('separate editing sessions never acknowledge each others drafts', async () => {
  const disk = storage(), a = { store: {} }, b = { store: { a: 1 } };
  const first = new drafts.DraftJournal('owner', 'board', 'tab1', () => {}, disk);
  const second = new drafts.DraftJournal('owner', 'board', 'tab2', () => {}, disk);
  first.write(a, 'r1'); second.write(b, 'r1'); await Promise.all([first.settled(), second.settled()]);
  first.acknowledge(a, 'r2'); await first.settled(); assert.equal(disk.rows.size, 1); assert.equal(disk.rows.get('tab2').snapshot, b);
});
test('storage failures are reported and later writes can recover', async () => {
  let failed = 0; const disk = storage(); let unavailable = true;
  const j = new drafts.DraftJournal('owner', 'board', 'tab', () => failed++, { ...disk, async write(d) { if (unavailable) throw Error('quota'); await disk.write(d); } });
  j.write({}, 'r1'); await j.settled(); assert.equal(failed, 1); unavailable = false; j.write({ a: 1 }, 'r1'); await j.settled(); assert.equal(disk.rows.size, 1);
});
test('new edit queued just after acknowledgement survives disk removal', async () => {
  const disk = storage(); const j = new drafts.DraftJournal('owner', 'board', 'tab', () => {}, disk); const a = {}, b = { b: 1 };
  j.write(a, 'r1'); j.acknowledge(a, 'r2'); j.write(b, 'r2'); await j.settled(); assert.equal(disk.rows.get('tab').snapshot, b);
});
const layout = load('lib/boards/layout.ts');
const handoff = load('lib/boards/handoff.ts');
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
test('transfer URL parsing rejects malformed, oversized and repeated inputs safely', () => {
  assert.equal(handoff.parseTransfer('bad', uuid(1)), undefined);
  assert.equal(handoff.parseTransfer(`reference:${uuid(1)}`, 'bad'), undefined);
  assert.equal(handoff.parseTransfer(Array.from({length:101}, (_,i)=>`reference:${uuid(i)}`).join(','), uuid(1)), undefined);
  assert.deepEqual(handoff.parseTransfer(`reference:${uuid(1)},reference:${uuid(1)}`, uuid(2)), { id: uuid(2), keys: [`reference:${uuid(1)}`] });
});
function harness({ foreign = false, missing = false, failImport = false } = {}) {
  const calls = []; const boards = []; const ref = { key: `reference:${uuid(1)}`, id: uuid(1), type: 'reference', title: 'Study', subtitle: '', role: 'visual', themeIds: [], topicIds: [], href: '/' };
  const db = { from(table) {
    const filters = {}; let row; let single = false;
    const q = { select() { return q; }, eq(k,v) { filters[k]=v; calls.push([table,k,v]); return q; }, in(k,v) { filters[k]=v; return q; }, order() { return q; }, limit() { return q; }, single() { single=true; return q; }, upsert(r) { row=r; return q; }, then(resolve) {
      let data = null;
      if (table==='boards') { if(row && !boards.some(b=>b.id===row.id)) boards.push(row); data = boards.find(b=>b.id===filters.id) || (!foreign ? {id: filters.id} : null); }
      if(table==='collections') data = foreign ? null : {id:'collection'};
      if(table==='collection_items') data = missing ? [] : [{record_id:uuid(1)}];
      if(table==='research_sessions') data = foreign ? null : {id:'session',result_snapshot:[{id:'result'}]};
      return Promise.resolve({data: single ? data : data, error:null}).then(resolve);
    } }; return q;
  } };
  const api = load('app/(workspace)/boards/handoff-actions.ts', {
    '@/lib/auth': { requireUser:async()=>({id:'owner'}) }, '@/lib/supabase/server':{createClient:async()=>db},
    '@/lib/boards/catalog':{boardCatalog:async()=>[ref]}, '@/lib/boards/layout':layout,
    '../discover/actions':{importDiscover:async()=>{calls.push(['import']);return failImport?{error:'Import failed'}:{savedItems:{result:uuid(1)}};}},
  });
  return {api,calls,boards};
}
const input = {source:{type:'collection',id:'collection'},selected:[uuid(1)],title:'Wall',layout:'research_wall',requestId:uuid(9)};
test('collection handoff validates membership and creates one retry-safe board', async()=>{
  const h=harness(); const url=await h.api.handoffToBoard(input); await h.api.handoffToBoard(input);
  assert.equal(url,`/boards/${uuid(9)}`); assert.equal(h.boards.length,1); assert.equal(h.boards[0].metadata.composition.placements[0].key,`reference:${uuid(1)}`);
  assert.ok(h.calls.some(c=>c[1]==='owner_id'&&c[2]==='owner'));
  await assert.rejects(harness({missing:true}).api.handoffToBoard(input),/selection changed/);
  await assert.rejects(harness({foreign:true}).api.handoffToBoard(input),/unavailable/);
});
test('existing-board handoff returns validated source keys without mutating its snapshot', async()=>{
  const h=harness(); const url=await h.api.handoffToBoard({...input,boardId:uuid(8)});
  assert.ok(url.startsWith(`/boards/${uuid(8)}?`)); assert.equal(h.boards.length,0);
  assert.equal(new URL(url,'https://local').searchParams.get('add'),`reference:${uuid(1)}`);
});
test('Discover validates destination before import and reuses imported reference identity',async()=>{
  const request={...input,source:{type:'discover',id:'session'},selected:['result'],boardId:uuid(8)};
  const h=harness(); assert.match(await h.api.handoffToBoard(request),/add=reference/); assert.equal(h.calls.filter(c=>c[0]==='import').length,1);
  const foreign=harness({foreign:true}); await assert.rejects(foreign.api.handoffToBoard(request),/unavailable/); assert.equal(foreign.calls.filter(c=>c[0]==='import').length,0);
  await assert.rejects(harness({failImport:true}).api.handoffToBoard(request),/Import failed/);
});
test('handoff rejects empty selection and selection above 100',async()=>{
  await assert.rejects(harness().api.handoffToBoard({...input,selected:[]}),/100/);
  await assert.rejects(harness().api.handoffToBoard({...input,selected:Array.from({length:101},(_,i)=>uuid(i))}),/100/);
});
test('transfer receipt prevents duplicates even when transferred cards were later deleted',()=>{
  const page={id:'page:1',meta:{}}; const inserted=[];
  const api=load('lib/boards/transfer.ts',{'tldraw':{Box:{Common:()=>({maxX:500})}},'./layout':layout,'./insertion':{insertResearchRecord:(ed,r,p)=>{inserted.push(p);return `shape:${inserted.length}`;}}});
  const editor={store:{allRecords:()=>[]},getCurrentPage:()=>page,getCurrentPageShapes:()=>[{type:'note'}],getShapePageBounds:()=>({x:0}),run:fn=>fn(),updatePage:p=>Object.assign(page,p),select:()=>{}};
  const record={key:`reference:${uuid(1)}`,id:uuid(1),type:'reference',title:'Study',subtitle:'',role:'visual',themeIds:[]};
  const transfer={id:uuid(9),keys:[record.key]};
  assert.equal(api.applyBoardTransfer(editor,transfer,[record]),true); assert.ok(inserted[0].x>500);
  assert.equal(api.applyBoardTransfer(editor,transfer,[record]),false);assert.equal(inserted.length,1);
  assert.throws(()=>api.applyBoardTransfer(editor,{id:uuid(10),keys:['missing']},[record]),/no longer available/);assert.equal(inserted.length,1);
  editor.store.allRecords=()=>Array.from({length:500},()=>({typeName:'shape',type:'research-record'}));
  assert.throws(()=>api.applyBoardTransfer(editor,{id:uuid(11),keys:[record.key]},[record]),/500/);
});

function recoveryHarness({ foreign = false, failSave = false } = {}) {
 const rows = []; const saves = [];
 const db = { from() { let id, owner, row; const q = { select(){return q;},eq(k,v){if(k==='id')id=v;if(k==='owner_id')owner=v;return q;},single(){return q;},upsert(r){row=r;return q;},then(resolve){if(row&&!rows.some(r=>r.id===row.id))rows.push({...row,updated_at:'r1',snapshot:null});const data=id==='source'?(!foreign&&owner==='owner'?{title:'Study',research_thread_id:'topic'}:null):rows.find(r=>r.id===id&&r.owner_id===owner);return Promise.resolve({data,error:null}).then(resolve);}};return q;}};
 const api=load('app/(workspace)/boards/recovery-actions.ts',{'@/lib/auth':{requireUser:async()=>({id:'owner'})},'@/lib/supabase/server':{createClient:async()=>db},'./actions':{saveBoard:async(id,revision,snapshot)=>{saves.push({id,revision,snapshot});if(failSave)throw Error('Save failed');rows.find(r=>r.id===id).snapshot=snapshot;}}});
 return {api,rows,saves};
}
test('recovery copies retain source context, use the atomic save and are retry-safe',async()=>{
 const h=recoveryHarness();const snapshot={store:{}};await h.api.copyRecoveredBoard('source',uuid(9),snapshot);await h.api.copyRecoveredBoard('source',uuid(9),snapshot);
 assert.equal(h.rows.length,1);assert.equal(h.saves.length,1);assert.equal(h.rows[0].research_thread_id,'topic');assert.equal(h.saves[0].snapshot,snapshot);
});
test('recovery rejects foreign source and surfaces persistence failure without reporting success',async()=>{
 await assert.rejects(recoveryHarness({foreign:true}).api.copyRecoveredBoard('source',uuid(9),{}),/not found/);
 const h=recoveryHarness({failSave:true});await assert.rejects(h.api.copyRecoveredBoard('source',uuid(9),{}),/Save failed/);assert.equal(h.rows[0].snapshot,null);
});
test('durability is reported only after the most recent disk transaction completes',async()=>{
 const disk=storage();const j=new drafts.DraftJournal('owner','board','tab',()=>{},disk);j.write({},'r1');assert.equal(j.isDurable(),false);await j.settled();assert.equal(j.isDurable(),true);j.write({new:true},'r1');assert.equal(j.isDurable(),false);await j.settled();assert.equal(j.isDurable(),true);
});

test('server JSONB key ordering does not turn an acknowledged save into a recoverable draft',()=>{
 const snapshot={store:{b:{props:{w:1,h:2}},a:{type:'note'}}};const reordered={store:{a:{type:'note'},b:{props:{h:2,w:1}}}};
 assert.equal(drafts.draftMatchesServer({snapshot},reordered),true);
 assert.equal(drafts.draftMatchesServer({snapshot},{store:{}}),false);
});
