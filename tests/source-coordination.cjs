/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
function load(file,mocks={}){const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(name=>{if(name in mocks)return mocks[name];throw Error(`Unexpected import ${name}`);},mod,mod.exports);return mod.exports;}
const routes=load('lib/records.ts'),live=load('lib/boards/live-records.ts'),content=load('lib/content.ts');
function database(tables={},failure=''){
 const calls=[];
 const db={calls,from(table){const filters=[];let update,one=false,start=0,end=Infinity;
  const q={select(fields){calls.push(['select',table,fields]);return q;},eq(key,value){filters.push(r=>r[key]===value);calls.push(['eq',table,key,value]);return q;},in(key,values){filters.push(r=>values.includes(r[key]));calls.push(['in',table,key,values]);return q;},is(key,value){filters.push(r=>r[key]===value);return q;},contains(key,value){filters.push(r=>value.composition.placements.every(p=>r[key]?.composition?.placements?.some(x=>x.key===p.key)));return q;},order(){return q;},range(a,b){start=a;end=b;return q;},update(value){update=value;return q;},single(){one=true;return q;},then(resolve){let rows=(tables[table]||[]).filter(r=>filters.every(f=>f(r))).slice(start,end+1);if(update && failure!==table)rows.forEach(r=>Object.assign(r,update));return Promise.resolve({data:one?rows[0]||null:rows,error:failure===table?{message:'offline'}:null}).then(resolve);}};return q;
 },storage:{from(bucket){return {async remove(paths){calls.push(['remove',bucket,paths]);return {error:failure==='storage'?{message:'offline'}:null};}};}},async rpc(name,args){calls.push(['rpc',name,args]);return {error:failure==='rpc'?{message:'offline'}:null};}};
 return db;
}
test('stable source routes and literal title searches',()=>{
 assert.equal(routes.recordHref('media','image-id'),'/library/items/media/image-id');
 assert.equal(routes.recordHref('note','note-id'),'/library/items/note/note-id');
 assert.equal(routes.isRecordKind('__proto__'),false);
 assert.equal(routes.searchPattern('  50%_test  '),'%50\\%\\_test%');
});
test('board source verification queries only deduplicated placed IDs and fails closed on DB errors',async()=>{
 const db=database({references:[{id:'a',owner_id:'owner'},{id:'foreign',owner_id:'other'}],relationships:[{id:'t',owner_id:'owner',source_type:'research_thread',relationship_type:'has_theme',target_type:'tag'},{id:'fake',owner_id:'owner',source_type:'reference'}]});
 const items=[{record_type:'reference',record_id:'a'},{record_type:'reference',record_id:'a'},{record_type:'reference',record_id:'foreign'},{record_type:'reference',record_id:'deleted'},{record_type:'theme',record_id:'t'},{record_type:'theme',record_id:'fake'}];
 assert.deepEqual([...(await live.liveRecordKeys(db,'owner',items))],['reference:a','theme:t']);
 assert.equal(db.calls.filter(c=>c[0]==='select').length,2);assert.ok(db.calls.filter(c=>c[0]==='select').every(c=>c[2]==='id'));
 assert.deepEqual(db.calls.find(c=>c[0]==='in'&&c[1]==='references')[3],['a','foreign','deleted']);
 await assert.rejects(live.liveRecordKeys(database({},'references'),'owner',items),/verify/);
 await assert.rejects(live.liveRecordKeys(db,'owner',[{record_type:'__proto__',record_id:'x'}]),/Invalid/);
 await assert.rejects(live.liveRecordKeys(db,'owner',Array(501).fill(items[0])),/Too many/);
 const empty=database();await live.liveRecordKeys(empty,'owner',[]);assert.equal(empty.calls.length,0);
});
test('Used in resolves direct links, covers, saved and unopened boards without duplicates or foreign titles',async()=>{
 const own=row=>({owner_id:'owner',...row});
 const db=database({
  relationships:[own({id:'l1',source_type:'research_thread',source_id:'topic',target_type:'media',target_id:'img'}),own({id:'l2',source_type:'reference',source_id:'ref',target_type:'media',target_id:'img'}),{id:'l3',owner_id:'other',source_type:'project',source_id:'secret',target_type:'media',target_id:'img'}],
  collection_items:[own({id:'c1',collection_id:'collection',record_type:'media',record_id:'img'})],
  board_items:[own({id:'b1',board_id:'saved',record_type:'media',record_id:'img'}),own({id:'b2',board_id:'saved',record_type:'media',record_id:'img'})],
  boards:[own({id:'saved',title:'Saved board',snapshot:{store:{}}}),own({id:'new',title:'Unopened board',snapshot:null,metadata:{composition:{placements:[{key:'media:img'}]}}}),own({id:'removed',title:'No longer placed',snapshot:{store:{}},metadata:{composition:{placements:[{key:'media:img'}]}}})],
  research_threads:[own({id:'topic',title:'Question'})],references:[own({id:'ref',title:'Source',primary_media_id:'img'})],
  projects:[own({id:'cover',title:'Cover project',cover_media_id:'img'}),{id:'secret',owner_id:'other',title:'Secret',cover_media_id:'img'}],collections:[own({id:'collection',title:'Set'})]
 });
 const api=load('lib/record-usage.ts',{'@/lib/supabase/server':{createClient:async()=>db},'@/lib/records':routes});
 const result=await api.recordUsage('owner','media','img');assert.deepEqual(result.map(x=>x.id).sort(),['collection','cover','new','ref','saved','topic']);assert.ok(result.every(x=>x.href.startsWith('/')));
});
test('Used in includes note parent and surfaces query failures instead of reporting zero locations',async()=>{
 const db=database({notes:[{id:'n',owner_id:'owner',parent_type:'project',parent_id:'p'}],projects:[{id:'p',owner_id:'owner',title:'Parent'}]});
 const api=load('lib/record-usage.ts',{'@/lib/supabase/server':{createClient:async()=>db},'@/lib/records':routes});assert.equal((await api.recordUsage('owner','note','n'))[0].title,'Parent');
 const broken=load('lib/record-usage.ts',{'@/lib/supabase/server':{createClient:async()=>database({},'relationships')},'@/lib/records':routes});await assert.rejects(broken.recordUsage('owner','media','m'),/locations/);
});
function actions(db,authenticated=true){return load('app/actions/content.ts',{'next/cache':{revalidatePath(){}},'@/lib/auth':{requireUser:async()=>{if(!authenticated)throw Error('Authentication required');return {id:'owner'};}},'@/lib/supabase/server':{createClient:async()=>db},'@/lib/content':content});}
test('content actions reject unauthenticated, foreign and unconfirmed deletion before touching Storage',async()=>{
 const db=database({media:[{id:'m',owner_id:'other',storage_path:'other/m.png',bucket:'research-media'}]});
 await assert.rejects(actions(db,false).deleteContent('media','m','DELETE'),/Authentication/);
 await assert.rejects(actions(db).deleteContent('media','m','yes'),/Confirm/);
 await assert.rejects(actions(db).deleteContent('__proto__','m','DELETE'),/Confirm/);
 await assert.rejects(actions(db).deleteContent('media','m','DELETE'),/unavailable/);
 assert.equal(db.calls.filter(c=>['remove','rpc'].includes(c[0])).length,0);
});
test('Storage failure retains the library record; cleanup failure can be retried',async()=>{
 const tables={media:[{id:'m',owner_id:'owner',storage_path:'owner/m.pdf',bucket:'research-media',media_type:'document'}]};
 const failed=database(tables,'storage');await assert.rejects(actions(failed).deleteContent('media','m','DELETE'),/Nothing has been removed/);assert.equal(failed.calls.some(c=>c[0]==='rpc'),false);
 const cleanup=database(tables,'rpc');await assert.rejects(actions(cleanup).deleteContent('media','m','DELETE'),/Retry deletion/);assert.deepEqual(cleanup.calls.filter(c=>['remove','rpc'].includes(c[0])).map(c=>c[0]),['remove','rpc']);
 const success=database(tables);assert.equal(await actions(success).deleteContent('media','m','DELETE'),'/library?view=documents');
 const wrong=database({media:[{...tables.media[0],storage_path:'other/file.pdf'}]});await assert.rejects(actions(wrong).deleteContent('media','m','DELETE'),/verified/);
});
test('editing retains rich content and provenance and rejects foreign records',async()=>{
 const note={id:'n',owner_id:'owner',title:'Old',plain_text:'Old',content:[{type:'paragraph'}],metadata:{source:'keep'}};
 const db=database({notes:[note]});await actions(db).editLibraryContent('note','n',{title:'New',text:'New text'});assert.equal(note.plain_text,'New text');assert.deepEqual(note.content,[{type:'paragraph'}]);assert.deepEqual(note.metadata,{source:'keep'});
 await assert.rejects(actions(db).editLibraryContent('note','foreign',{title:'X',text:'X'}),/Could not save/);
 await assert.rejects(actions(db).editLibraryContent('note','n',null),/Enter a title/);
});
