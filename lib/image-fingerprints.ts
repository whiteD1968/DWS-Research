import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { differenceHash, hashSize, isHash, pairKey } from "@/lib/image-hash";
import { imageBytes } from "@/lib/image-tagger";

// Fingerprints live in one owner-only settings note, so adding them never changes an image's "updated" date.
export const fingerprintParent = "image_fingerprints";
type Store = { id: string; metadata: Record<string, unknown>; hashes: Record<string, string>; distinct: string[] };

export async function hashImage(bytes: Buffer) {
  const pixels = await sharp(bytes, { failOn: "none" }).rotate().greyscale().resize(hashSize.width, hashSize.height, { fit: "fill" }).raw().toBuffer();
  return differenceHash(pixels);
}

export async function loadFingerprints(db: SupabaseClient, ownerId: string): Promise<Store | null> {
  const { data } = await db.from("notes").select("id,metadata").eq("owner_id", ownerId).eq("parent_type", fingerprintParent).order("created_at").limit(1).maybeSingle();
  if (!data) return null;
  const metadata = (data.metadata || {}) as Record<string, unknown>;
  const hashes = Object.fromEntries(Object.entries((metadata.hashes || {}) as Record<string, unknown>).filter((entry): entry is [string, string] => isHash(entry[1])));
  const distinct = Array.isArray(metadata.distinct) ? metadata.distinct.filter((pair): pair is string => typeof pair === "string") : [];
  return { id: String(data.id), metadata, hashes, distinct };
}

// Merges changes into the stored fingerprints: new hashes, removed images, and pairs marked as not duplicates.
export async function saveFingerprints(db: SupabaseClient, ownerId: string, change: { add?: Record<string, string>; remove?: string[]; distinct?: string[] }) {
  const store = await loadFingerprints(db, ownerId);
  const hashes = { ...(store?.hashes || {}), ...(change.add || {}) };
  (change.remove || []).forEach(id => delete hashes[id]);
  const distinct = [...new Set([...(store?.distinct || []), ...(change.distinct || [])])].slice(-5000);
  const metadata = { ...(store?.metadata || {}), hashes, distinct };
  const result = store
    ? await db.from("notes").update({ metadata }).eq("owner_id", ownerId).eq("id", store.id)
    : await db.from("notes").insert({ owner_id: ownerId, parent_type: fingerprintParent, title: "Image fingerprints", metadata });
  if (result.error) throw new Error("Could not save image fingerprints. Please retry.");
}

export const markDistinct = (db: SupabaseClient, ownerId: string, ids: string[]) =>
  saveFingerprints(db, ownerId, { distinct: ids.flatMap((a, i) => ids.slice(i + 1).map(b => pairKey(a, b))) });

export type FingerprintResult = { hashed: number; failed: number; remaining: number };

// Fingerprints images that don't have one yet, a batch at a time, and forgets images that were deleted.
export async function fingerprintImages(db: SupabaseClient, ownerId: string, { limit = 24, deadline = Date.now() + 40000 } = {}): Promise<FingerprintResult> {
  const [{ data: media, error }, store] = await Promise.all([
    db.from("media").select("id,title,original_filename,bucket,storage_path,alt_text,caption,metadata").eq("owner_id", ownerId).eq("media_type", "image").not("storage_path", "is", null).order("created_at", { ascending: false }).limit(5000),
    loadFingerprints(db, ownerId),
  ]);
  if (error) throw new Error("Could not load images. Please retry.");
  const known = store?.hashes || {};
  const failedBefore = new Set(Array.isArray(store?.metadata.unreadable) ? (store!.metadata.unreadable as string[]) : []);
  const pending = (media || []).filter(item => !known[String(item.id)] && !failedBefore.has(String(item.id)));
  const add: Record<string, string> = {}; const unreadable: string[] = [];
  for (let i = 0; i < Math.min(pending.length, limit); i += 6) {
    if (Date.now() > deadline) break;
    await Promise.all(pending.slice(i, Math.min(i + 6, limit)).map(async item => {
      const bytes = await imageBytes(db, ownerId, item as Parameters<typeof imageBytes>[2]).catch(() => null);
      const hash = bytes ? await hashImage(bytes).catch(() => null) : null;
      if (hash) add[String(item.id)] = hash; else unreadable.push(String(item.id));
    }));
  }
  const present = new Set((media || []).map(item => String(item.id)));
  const remove = Object.keys(known).filter(id => !present.has(id));
  if (Object.keys(add).length || remove.length || unreadable.length) {
    await saveFingerprints(db, ownerId, { add, remove });
    if (unreadable.length) {
      const fresh = await loadFingerprints(db, ownerId);
      if (fresh) await db.from("notes").update({ metadata: { ...fresh.metadata, unreadable: [...failedBefore, ...unreadable].slice(-2000) } }).eq("owner_id", ownerId).eq("id", fresh.id);
    }
  }
  const done = Object.keys(add).length + unreadable.length;
  return { hashed: Object.keys(add).length, failed: unreadable.length, remaining: Math.max(0, pending.length - done) };
}
