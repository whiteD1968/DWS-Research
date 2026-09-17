/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {PGlite}=require('@electric-sql/pglite');
test('image import: same-title images stay distinct, retries reuse references, provenance persists and owners stay isolated',async()=>{
 const db=new PGlite();try{
    await db.exec(`
      create role authenticated; create role anon;
      create schema auth; create schema storage;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table storage.buckets (id text primary key, name text, public boolean);
      create table storage.objects (id uuid, bucket_id text, name text);
      create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
    `);
    // gen_random_uuid is built into Postgres; PGlite does not need pgcrypto.
    await db.exec(fs.readFileSync('supabase/migrations/20260911193000_initial_dws_research_schema.sql', 'utf8').replace('create extension if not exists pgcrypto;', ''));
    await db.exec(fs.readFileSync('supabase/migrations/20260913172223_discover_research_sessions.sql', 'utf8'));
    await db.exec(fs.readFileSync('supabase/migrations/20260917143424_discover_image_import.sql', 'utf8'));
    await db.exec(`grant usage on schema public, auth to authenticated, anon; grant all on all tables in schema public to authenticated;`);

 const owner='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',session='20000000-0000-4000-8000-000000000001';
 await db.query('insert into auth.users(id) values ($1),($2)',[owner,other]);
 const images=Array.from({length:50},(_,i)=>({id:`image:${i}`,title:'Same pavilion title',resultType:'image',url:`https://example.com/image-${i}.jpg`,imageUrl:`https://example.com/image-${i}.jpg`,sourcePageUrl:'https://example.com/projects/pavilion',thumbnailUrl:`https://imgs.search.brave.com/image-${i}`,imageWidth:600,imageHeight:900}));
 await db.query('insert into research_sessions(id,owner_id,title,query,result_snapshot) values ($1,$2,$3,$3,$4)',[session,owner,'pavilion',JSON.stringify(images)]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);await db.exec('set role authenticated');
 const call=(ids,collection=null,title=null)=>db.query('select public.import_discover_results($1,$2,$3,$4) as result',[session,ids,collection,title]);
 const first=(await call(images.map(i=>i.id),null,'Image collection')).rows[0].result;
 assert.equal(Object.keys(first.savedItems).length,50);assert.equal(new Set(Object.values(first.savedItems)).size,50);
 const second=(await call(images.map(i=>i.id),first.collectionId)).rows[0].result;assert.deepEqual(first.savedItems,second.savedItems);
 const refs=(await db.query('select * from "references"')).rows;assert.equal(refs.length,50);assert.equal(refs[0].metadata.source_page_url,images[0].sourcePageUrl);assert.equal(refs[0].metadata.external_result.imageWidth,600);
 assert.equal((await db.query('select * from collection_items')).rows.length,50);
 await assert.rejects(call(['missing']),/Unknown result/);assert.equal((await db.query('select * from "references"')).rows.length,50);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);await assert.rejects(call(['image:0']),/unavailable/);assert.equal((await db.query('select * from "references"')).rows.length,0);
 await db.exec('reset role; set role anon');await assert.rejects(call(['image:0']),/permission denied/);
 }finally{await db.close();}
});
