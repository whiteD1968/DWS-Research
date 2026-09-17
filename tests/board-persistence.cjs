/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('Postgres baseline + board RPC: atomic save, PDF items, conflicts, rollback and owner RLS', async () => {
  const db = new PGlite();
  try {
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
    await db.exec(fs.readFileSync('supabase/migrations/20260916181217_board_snapshot_persistence.sql', 'utf8'));
    await db.exec(`grant usage on schema public, auth to authenticated, anon; grant all on all tables in schema public to authenticated;`);
    const owner = '10000000-0000-4000-8000-000000000001', stranger = '10000000-0000-4000-8000-000000000002';
    const board = '20000000-0000-4000-8000-000000000001', media = '30000000-0000-4000-8000-000000000001';
    await db.query('insert into auth.users (id) values ($1), ($2)', [owner, stranger]);
    await db.query("insert into public.boards (id,owner_id,title) values ($1,$2,'Board')", [board, owner]);
    await db.query("insert into public.media (id,owner_id,media_type,mime_type) values ($1,$2,'document','application/pdf')", [media, owner]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
    await db.exec('set role authenticated');
    let revision = (await db.query('select updated_at::text as revision from boards where id=$1', [board])).rows[0].revision;
    const item = { shape_id: 'shape:pdf', record_type: 'media', record_id: media, item_type: 'record', x: 4, y: 8, width: 280, height: 300, rotation: 0, z_index: 0, state: { parentId: 'shape:frame' } };
    const save = (rev, items, snapshot = { store: {} }) => db.query('select public.save_research_board($1,$2,$3,$4)::text as revision', [board, rev, JSON.stringify(snapshot), JSON.stringify(items)]);
    const saved = await save(revision, [item]);
    const rows = (await db.query('select * from board_items')).rows;
    assert.equal(rows.length, 1); assert.equal(rows[0].item_type, 'document'); assert.equal(rows[0].record_id, media);
    await assert.rejects(save(revision, []), /another session/);
    revision = saved.rows[0].revision;
    await assert.rejects(save(revision, [{ ...item, record_id: '30000000-0000-4000-8000-000000000099' }]), /Record not found/);
    assert.equal((await db.query('select * from board_items')).rows.length, 1);
    // Failure during insertion must roll back both deletion and snapshot update.
    await assert.rejects(save(revision, [{ ...item, width: 'not-a-number' }], { changed: true }), /invalid input/);
    assert.equal((await db.query('select * from board_items')).rows.length, 1);
    assert.deepEqual((await db.query('select snapshot from boards')).rows[0].snapshot, { store: {} });
    // A linked native Theme frame is an ordinary theme placement; no new schema is needed.
    const topic = '40000000-0000-4000-8000-000000000001', tag = '50000000-0000-4000-8000-000000000001', theme = '60000000-0000-4000-8000-000000000001';
    await db.query("insert into research_threads (id, owner_id, title) values ($1,$2,'Topic')", [topic, owner]);
    await db.query("insert into tags (id, owner_id, name) values ($1,$2,'Material systems')", [tag, owner]);
    await db.query("insert into relationships (id, owner_id, source_type, source_id, relationship_type, target_type, target_id) values ($1,$2,'research_thread',$3,'has_theme','tag',$4)", [theme, owner, topic, tag]);
    const themeItem = { ...item, shape_id: 'shape:theme', record_type: 'theme', record_id: theme, item_type: 'theme', width: 640, height: 360, state: { parentId: 'page:page' } };
    const nested = { ...item, state: { parentId: 'shape:theme' } };
    const frameSnapshot = { store: { frame: { type: 'frame', meta: { recordKey: `theme:${theme}` }, props: { w: 640, h: 360 } } } };
    revision = (await save(revision, [themeItem, nested], frameSnapshot)).rows[0].revision;
    const placements = (await db.query('select * from board_items order by shape_id')).rows;
    assert.equal(placements.length, 2);
    assert.equal(placements.find(p => p.shape_id === 'shape:theme').item_type, 'theme');
    assert.equal(placements.find(p => p.shape_id === 'shape:pdf').state.parentId, 'shape:theme');
    assert.deepEqual((await db.query('select snapshot from boards')).rows[0].snapshot, frameSnapshot);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [stranger]);
    assert.equal((await db.query('select * from boards')).rows.length, 0);
    assert.equal((await db.query('select * from board_items')).rows.length, 0);
    await assert.rejects(save(revision, []), /Board not found/);
    await db.exec('reset role; set role anon');
    await assert.rejects(save(revision, []), /permission denied/);
  } finally { await db.close(); }
});
