/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {PGlite}=require('@electric-sql/pglite');
test('content deletion cleans links atomically, preserves shared records, invalidates boards and isolates owners',async()=>{
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
    await db.exec(fs.readFileSync('supabase/migrations/20260919192226_repository_content_management.sql', 'utf8'));
    await db.exec(`grant usage on schema public, auth to authenticated, anon; grant all on all tables in schema public to authenticated;`);


 const owner='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
 await db.query('insert into auth.users(id) values ($1),($2)',[owner,other]);
 const insert=async(table,cols,values)=> (await db.query(`insert into public."${table}" (owner_id,${cols}) values ($1,${values.map((_,i)=>'$'+(i+2)).join(',')}) returning id`,[owner,...values])).rows[0].id;
 const ref=await insert('references','title',['Shared precedent']);
 const keep=await insert('references','title',['Keep']);
 const topic=await insert('research_threads','title',['Question']);
 const media=await insert('media','media_type,title',['image','Study']);
 const project=await insert('projects','title,cover_media_id',['Design',media]);
 const collection=await insert('collections','title',['Set']);
 const note=await insert('notes','title,parent_type,parent_id',['Finding','research_thread',topic]);
 const board=await insert('boards','title,research_thread_id,snapshot',['Wall',topic,JSON.stringify({store:{source:{props:{recordKey:'reference:'+ref}}}})]);
 const unopened=await insert('boards','title,metadata',['Unopened',JSON.stringify({composition:{frames:[],placements:[{key:'reference:'+ref},{key:'reference:'+keep}]}})]);
 const session=await insert('research_sessions','title,query,saved_items',['Search','stone',JSON.stringify({a:ref,b:keep})]);
 const tag=await insert('tags','name',['Theme']);
 const theme=await insert('relationships','source_type,source_id,relationship_type,target_type,target_id',['research_thread',topic,'has_theme','tag',tag]);
 await insert('relationships','source_type,source_id,relationship_type,target_type,target_id',['research_topic_theme',theme,'includes','reference',ref]);
 await insert('relationships','source_type,source_id,relationship_type,target_type,target_id',['research_thread',topic,'has_reference','reference',ref]);
 await insert('collection_items','collection_id,record_type,record_id',[collection,'reference',ref]);
 await insert('board_items','board_id,record_type,record_id',[board,'reference',ref]);
 await insert('board_items','board_id,record_type,record_id',[board,'theme',theme]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);await db.exec('set role authenticated');
 const del=(kind,id)=>db.query('select public.delete_research_content($1,$2)',[kind,id]);
 await assert.rejects(del('reference',ref),/unavailable/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await assert.rejects(del('profiles',owner),/Unsupported/);
 const before=(await db.query('select updated_at::text as rev from boards where id=$1',[board])).rows[0].rev;
 await del('reference',ref);
 assert.deepEqual((await db.query('select metadata from boards where id=$1',[unopened])).rows[0].metadata.composition.placements,[{key:'reference:'+keep}]);
 assert.equal((await db.query('select * from collection_items')).rows.length,0);
 assert.equal((await db.query("select * from relationships where target_type='reference'")).rows.length,0);
 assert.deepEqual((await db.query('select saved_items from research_sessions where id=$1',[session])).rows[0].saved_items,{b:keep});
 const after=(await db.query('select updated_at::text as rev,snapshot from boards where id=$1',[board])).rows[0];assert.notEqual(after.rev,before);assert.ok(after.snapshot.store.source);
 assert.equal((await db.query('select * from "references"')).rows.length,1);
 await del('research_thread',topic);
 assert.equal((await db.query('select * from relationships')).rows.length,0);
 assert.equal((await db.query('select * from board_items')).rows.length,0);
 assert.equal((await db.query('select parent_id from notes where id=$1',[note])).rows[0].parent_id,null);
 assert.equal((await db.query('select research_thread_id from boards where id=$1',[board])).rows[0].research_thread_id,null);
 await del('media',media);assert.equal((await db.query('select cover_media_id from projects where id=$1',[project])).rows[0].cover_media_id,null);
 await del('collection',collection);await del('project',project);await del('research_session',session);await del('board',board);await del('note',note);
 assert.equal((await db.query('select * from "references"')).rows.length,1);
 await db.exec('reset role;set role anon');await assert.rejects(del('reference',keep),/permission denied/);
 }finally{await db.close();}
});
