import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extensionFor, feedsFrom, imageCandidates, parseFeed, pinRecord, pinterestParent, type FeedPin, type PinterestFeed } from "@/lib/pinterest";

const headers = { "User-Agent": "Mozilla/5.0 (compatible; DWS Research)", Accept: "application/rss+xml, application/xml, text/xml" };

export async function fetchFeed(url: string) {
  const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!response) throw new Error("Couldn’t reach Pinterest. Please retry.");
  if (response.status === 404) throw new Error("Pinterest has no public feed at that address. Check the board link, and that the board isn’t secret.");
  if (!response.ok) throw new Error(`Pinterest answered with an error (${response.status}). Please retry later.`);
  const xml = await response.text();
  if (!/<rss[\s>]/i.test(xml)) throw new Error(`Pinterest sent a web page instead of the board’s feed (${response.status}, ${(response.headers.get("content-type") || "unknown").split(";")[0]}). It may be blocking automated requests.`);
  return parseFeed(xml);
}

async function download(url: string) {
  for (const candidate of imageCandidates(url)) {
    const response = await fetch(candidate, { cache: "no-store", signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (!response?.ok) continue;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length && bytes.length <= 20 * 1024 * 1024) return bytes;
  }
  return null;
}

async function saveImage(db: SupabaseClient, ownerId: string, pin: FeedPin, feed: PinterestFeed) {
  const bytes = await download(pin.image);
  if (!bytes) return null;
  const info = await sharp(bytes, { limitInputPixels: 100000000 }).metadata().catch(() => null);
  const mime = info?.format === "jpeg" ? "image/jpeg" : info?.format ? `image/${info.format}` : "";
  const extension = extensionFor(mime);
  if (!extension) return null;
  const path = `${ownerId}/pinterest/${pin.id}.${extension}`;
  const upload = await db.storage.from("research-media").upload(path, bytes, { contentType: mime, upsert: true });
  if (upload.error) return null;
  const record = pinRecord(pin, feed);
  const id = crypto.randomUUID();
  const { error } = await db.from("media").insert({ id, owner_id: ownerId, media_type: "image", bucket: "research-media", storage_path: path, mime_type: mime, byte_size: bytes.length, width: info?.width || null, height: info?.height || null, ...record, original_filename: `${record.original_filename}.${extension}`, title: record.title === record.original_filename ? `${record.title}.${extension}` : record.title });
  if (error) { await db.storage.from("research-media").remove([path]); return null; }
  return id;
}

// Each followed board has its own Collection, made the first time it imports.
async function feedCollection(db: SupabaseClient, ownerId: string, feed: PinterestFeed, title: string) {
  if (feed.collectionId) {
    const { data } = await db.from("collections").select("id").eq("owner_id", ownerId).eq("id", feed.collectionId).maybeSingle();
    if (data) return String(data.id);
  }
  const { data, error } = await db.from("collections").insert({ owner_id: ownerId, title: (title || feed.label).slice(0, 200), description: "Imported from Pinterest.", metadata: { origin: "pinterest", pinterest_feed: feed.url } }).select("id").single();
  if (error || !data) throw new Error("Could not create a Collection for that board.");
  return String(data.id);
}

export type FeedResult = { imported: number; skipped: number; failed: number; collectionId: string; title: string };

// Brings in the pins in one board's feed that aren't in the Library yet.
export async function importFeed(db: SupabaseClient, ownerId: string, feed: PinterestFeed, deadline = Date.now() + 45000): Promise<FeedResult> {
  const { title, pins } = await fetchFeed(feed.url);
  const collectionId = await feedCollection(db, ownerId, feed, title);
  const { data: known } = pins.length ? await db.from("media").select("id,metadata->pinterest->>pin_id").eq("owner_id", ownerId).in("metadata->pinterest->>pin_id", pins.map(pin => pin.id)) : { data: [] };
  const existing = new Map((known || []).map(row => [String((row as Record<string, unknown>).pin_id), String(row.id)]));
  const ids: string[] = []; let imported = 0; let skipped = 0; let failed = 0;
  for (let index = 0; index < pins.length; index += 4) {
    if (Date.now() > deadline) break;
    await Promise.all(pins.slice(index, index + 4).map(async pin => {
      const already = existing.get(pin.id);
      if (already) { skipped += 1; ids.push(already); return; }
      const id = await saveImage(db, ownerId, pin, feed).catch(() => null);
      if (id) { imported += 1; ids.push(id); } else failed += 1;
    }));
  }
  if (ids.length) await db.from("collection_items").upsert(ids.map(id => ({ owner_id: ownerId, collection_id: collectionId, record_type: "media", record_id: id })), { onConflict: "collection_id,record_type,record_id", ignoreDuplicates: true });
  return { imported, skipped, failed, collectionId, title: title || feed.label };
}

export async function pinterestSettings(db: SupabaseClient, ownerId: string) {
  const { data } = await db.from("notes").select("id,metadata").eq("owner_id", ownerId).eq("parent_type", pinterestParent).order("created_at").limit(1).maybeSingle();
  return data ? { id: String(data.id), metadata: (data.metadata || {}) as Record<string, unknown>, feeds: feedsFrom(data.metadata) } : null;
}

export async function saveFeeds(db: SupabaseClient, ownerId: string, feeds: PinterestFeed[]) {
  const row = await pinterestSettings(db, ownerId);
  const result = row
    ? await db.from("notes").update({ metadata: { ...row.metadata, feeds } }).eq("owner_id", ownerId).eq("id", row.id)
    : await db.from("notes").insert({ owner_id: ownerId, parent_type: pinterestParent, title: "Pinterest", metadata: { feeds } });
  if (result.error) throw new Error("Could not save. Please retry.");
}

// Imports one followed board and records how it went; used by the page and the morning run.
export async function syncFeed(db: SupabaseClient, ownerId: string, url: string, deadline?: number) {
  const row = await pinterestSettings(db, ownerId);
  const feed = row?.feeds.find(item => item.url === url);
  if (!row || !feed) throw new Error("That board isn’t followed any more. Refresh the page.");
  let result: FeedResult | null = null; let failure = "";
  try { result = await importFeed(db, ownerId, feed, deadline); } catch (problem) { failure = problem instanceof Error ? problem.message : "Import failed."; }
  const fresh = (await pinterestSettings(db, ownerId))?.feeds || row.feeds;
  await saveFeeds(db, ownerId, fresh.map(item => item.url !== url ? item : { ...item, label: result?.title || item.label, collectionId: result?.collectionId || item.collectionId, lastSync: new Date().toISOString(), lastError: failure || undefined, imported: (item.imported || 0) + (result?.imported || 0) }));
  if (!result) throw new Error(failure);
  return result;
}

export async function syncPinterestFor(db: SupabaseClient, ownerId: string, deadline = Date.now() + 40000) {
  const row = await pinterestSettings(db, ownerId);
  let imported = 0; let failed = 0;
  for (const feed of row?.feeds || []) {
    if (Date.now() > deadline - 10000) break;
    try { imported += (await syncFeed(db, ownerId, feed.url, deadline)).imported; } catch { failed += 1; }
  }
  return { imported, failed };
}
