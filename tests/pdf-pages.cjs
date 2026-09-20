/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('lib/pdf-pages.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', code)(mod, mod.exports);
const { pdfPageImagePath, validPageNumber } = mod.exports;
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('PDF page images stay under the owner and source document path', () => {
  assert.equal(pdfPageImagePath(id(1), id(2), id(3)), `${id(1)}/pdf-pages/${id(2)}/${id(3)}.png`);
  assert.throws(() => pdfPageImagePath(id(1), '../other', id(3)), /Invalid page identity/);
  assert.throws(() => pdfPageImagePath('someone-else', id(2), id(3)), /Invalid page identity/);
});

test('PDF page numbers reject invalid and excessive values', () => {
  assert.equal(validPageNumber(1), true);
  assert.equal(validPageNumber(10000), true);
  for (const page of [0, -1, 1.5, Infinity, NaN, 10001]) assert.equal(validPageNumber(page), false);
});

function pageActionHarness({ missingDocument = false, storageFailure = false } = {}) {
  const rows = new Map();
  const calls = [];
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(16)]);
  const db = {
    storage: { from(bucket) { assert.equal(bucket, 'research-media'); return { async download(path) {
      calls.push(['download',path]); return storageFailure ? {data:null,error:{message:'failed'}} : {data:{size:png.length,arrayBuffer:async()=>png},error:null};
    } }; } },
    from(table) {
      const filters = {}; let operation = null;
      const q = {
        select() { return q; }, eq(field,value) { filters[field]=value; return q; },
        single() { return Promise.resolve({data: table==='media' && filters.id===id(2) && !missingDocument ? {id:id(2),title:'Source PDF',mime_type:'application/pdf'} : null,error:table==='media' && filters.id===id(2) && !missingDocument ? null : {message:'missing'}}); },
        maybeSingle() { return Promise.resolve({data:rows.get(filters.id)||null,error:null}); },
        upsert(value) { operation=['upsert',table,value]; calls.push(operation); if (table==='media') rows.set(value.id,value); return Promise.resolve({error:null}); },
        update(value) { operation=['update',table,value]; calls.push(operation); return q; },
        then(resolve) { if (operation?.[0]==='update') rows.set(filters.id,{...rows.get(filters.id),...operation[2]}); return Promise.resolve({error:null}).then(resolve); },
      };
      return q;
    },
  };
  const script = fs.readFileSync('app/(workspace)/library/items/media/pdf-page-actions.ts','utf8');
  const compiled = ts.transpileModule(script,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const action = {exports:{}};
  new Function('require','module','exports',compiled)(name=>{
    const mocks = {
      sharp: ()=>({metadata:async()=>({format:'png',width:900,height:1200})}),
      'next/cache': {revalidatePath:()=>{}},
      '@/lib/auth': {requireUser:async()=>({id:id(1)})},
      '@/lib/supabase/server': {createClient:async()=>db},
      '@/lib/pdf-pages': mod.exports,
    };
    if (!(name in mocks)) throw Error(`Unexpected import ${name}`);
    return mocks[name];
  },action,action.exports);
  return {finish:action.exports.finishPdfPage,calls,rows};
}

test('PDF page finalization checks owner, bytes and provenance; retry reuses the same source', async()=>{
  const h=pageActionHarness();
  await h.finish(id(2),id(3),2,'Page title','Observation','Extracted text');
  assert.equal(h.rows.get(id(3)).source_page,2);
  assert.equal(h.rows.get(id(3)).metadata.source_document_id,id(2));
  assert.ok(h.calls.some(call=>call[0]==='upsert'&&call[1]==='relationships'&&call[2].relationship_type==='derived_from'));
  await h.finish(id(2),id(3),2,'Revised title','Revised note','Text');
  assert.equal(h.calls.filter(call=>call[0]==='download').length,1);
  assert.equal(h.rows.get(id(3)).title,'Revised title');
  await assert.rejects(h.finish(id(2),id(3),3,'Wrong page','',''),/identity conflict/);
  await assert.rejects(pageActionHarness({missingDocument:true}).finish(id(2),id(3),2,'Title','',''),/PDF source unavailable/);
  await assert.rejects(pageActionHarness({storageFailure:true}).finish(id(2),id(3),2,'Title','',''),/unavailable or too large/);
});
