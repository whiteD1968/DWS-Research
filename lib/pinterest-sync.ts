import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bestImage, extensionFor, pinRecord, pinterestApi, pinterestParent, pinterestSettingsFrom, tokenSettings, type Pin, type PinterestBoard } from "@/lib/pinterest";

type Settings = { id: string; metadata: Record<string, unknown> };

// Pinterest's token endpoint takes the app's ID and secret as basic auth.
export async function requestToken(body: Record<string, string>) {
  const auth = Buffer.from(`${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`).toString("base64");
  const response = await fetch(`${pinterestApi}/oauth/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body), cache: "no-store", signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!response) throw new Error("Couldn’t reach Pinterest. Please retry.");
  const data = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; expires_in?: number; refresh_token_expires_in?: number; message?: string };
  if (!response.ok || !data.access_token) throw new Error(response.status === 401 ? "Pinterest turned down the app keys. Check PINTEREST_APP_ID and PINTEREST_APP_SECRET in Vercel." : "Pinterest didn’t accept the sign-in. Please connect again.");
  return data;
}

async function loadSettings(db: SupabaseClient, ownerId: string): Promise<Settings> {
  const { data } = await db.from("notes").select("id,metadata").eq("owner_id", ownerId).eq("parent_type", pinterestParent).order("created_at").limit(1).maybeSingle();
  if (!data || !pinterestSettingsFrom(data.metadata).accessToken) throw new Error("Connect Pinterest first.");
  return { id: String(data.id), metadata: (data.metadata || {}) as Record<string, unknown> };
}

// A token that is about to run out is swapped for a fresh one first.
async function accessToken(db: SupabaseClient, ownerId: string) {
  const row = await loadSettings(db, ownerId);
  const settings = pinterestSettingsFrom(row.metadata);
  if (settings.expiresAt > Date.now()) return settings.accessToken;
  if (!settings.refreshToken || (settings.refreshExpiresAt && settings.refreshExpiresAt < Date.now())) throw new Error("Your Pinterest sign-in has expired. Connect Pinterest again.");
  const fresh = tokenSettings(await requestToken({ grant_type: "refresh_token", refresh_token: settings.refreshToken }), Date.now(), settings.refreshToken);
  if (!fresh) throw new Error("Your Pinterest sign-in has expired. Connect Pinterest again.");
  await db.from("notes").update({ metadata: { ...row.metadata, ...fresh } }).eq("owner_id", ownerId).eq("id", row.id);
  return fresh.access_token;
}

export async function pinterestGet<T>(token: string, path: string) {
  const response = await fetch(`${pinterestApi}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!response) throw new Error("Couldn’t reach Pinterest. Please retry.");
  if (response.status === 401) throw new Error("Your Pinterest sign-in has expired. Connect Pinterest again.");
  if (response.status === 403) throw new Error("Pinterest didn’t allow that. The app may need more access on developers.pinterest.com.");
  if (response.status === 429) throw new Error("Pinterest is limiting requests right now. Try again in a few minutes.");
  if (!response.ok) throw new Error("Pinterest didn’t answer. Please retry.");
  return await response.json() as T;
}

export async function pinterestBoards(db: SupabaseClient, ownerId: string) {
  const token = await accessToken(db, ownerId);
  const boards: PinterestBoard[] = [];
  let bookmark = "";
  for (let page = 0; page < 10; page += 1) {
    const data = await pinterestGet<{ items?: PinterestBoard[]; bookmark?: string | null }>(token, `/boards?page_size=100${bookmark ? `&bookmark=${encodeURIComponent(bookmark)}` : ""}`);
    boards.push(...(data.items || []));
    if (!data.bookmark) break;
    bookmark = data.bookmark;
  }
  return boards;
}

// Each board becomes a Collection, found again by its Pinterest ID on later imports.
async function boardCollection(db: SupabaseClient, ownerId: string, board: { id: string; name: string; description?: string }) {
  const { data: existing } = await db.from("collections").select("id").eq("owner_id", ownerId).eq("metadata->>pinterest_board_id", board.id).limit(1).maybeSingle();
  if (existing) return String(existing.id);
  const { data, error } = await db.from("collections").insert({ owner_id: ownerId, title: board.name.slice(0, 200) || "Pinterest board", description: board.description?.slice(0, 2000) || "Imported from Pinterest.", metadata: { origin: "pinterest", pinterest_board_id: board.id } }).select("id").single();
  if (error || !data) throw new Error("Could not create a Collection for that board.");
  return String(data.id);
}

async function saveImage(db: SupabaseClient, ownerId: string, pin: Pin, board: { id: string; name: string }, section: string) {
  const image = bestImage(pin);
  if (!image?.url) return null;
  const response = await fetch(image.url, { cache: "no-store", signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!response?.ok) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) return null;
  const info = await sharp(bytes, { limitInputPixels: 100000000 }).metadata().catch(() => null);
  const mime = info?.format === "jpeg" ? "image/jpeg" : info?.format ? `image/${info.format}` : "";
  const extension = extensionFor(mime);
  if (!extension) return null;
  const id = crypto.randomUUID();
  const path = `${ownerId}/pinterest/${pin.id}.${extension}`;
  const upload = await db.storage.from("research-media").upload(path, bytes, { contentType: mime, upsert: true });
  if (upload.error) return null;
  const record = pinRecord(pin, board, section);
  const { error } = await db.from("media").insert({ id, owner_id: ownerId, media_type: "image", bucket: "research-media", storage_path: path, mime_type: mime, byte_size: bytes.length, width: info?.width || null, height: info?.height || null, ...record, original_filename: `${record.original_filename}.${extension}`, title: record.title === record.original_filename ? `${record.title}.${extension}` : record.title });
  if (error) { await db.storage.from("research-media").remove([path]); return null; }
  return id;
}

export type ImportResult = { imported: number; skipped: number; failed: number; bookmark: string; done: boolean; collectionId: string };

// Imports one board a page at a time until the time budget runs out. Pins already in the Library are skipped without downloading.
export async function importPinterestBoard(db: SupabaseClient, ownerId: string, board: { id: string; name: string; description?: string }, startBookmark = "", deadline = Date.now() + 45000): Promise<ImportResult> {
  const token = await accessToken(db, ownerId);
  const collectionId = await boardCollection(db, ownerId, board);
  const sections = await pinterestGet<{ items?: { id: string; name: string }[] }>(token, `/boards/${encodeURIComponent(board.id)}/sections?page_size=100`).catch(() => ({ items: [] }));
  const sectionName = new Map((sections.items || []).map(section => [section.id, section.name]));
  let bookmark = startBookmark; let imported = 0; let skipped = 0; let failed = 0; let done = false;
  while (Date.now() < deadline - 20000) {
    const page = await pinterestGet<{ items?: Pin[]; bookmark?: string | null }>(token, `/boards/${encodeURIComponent(board.id)}/pins?page_size=25${bookmark ? `&bookmark=${encodeURIComponent(bookmark)}` : ""}`);
    const pins = (page.items || []).filter(pin => typeof pin.id === "string");
    const { data: known } = pins.length ? await db.from("media").select("id,metadata->pinterest->>pin_id").eq("owner_id", ownerId).in("metadata->pinterest->>pin_id", pins.map(pin => pin.id)) : { data: [] };
    const existing = new Map((known || []).map(row => [String((row as Record<string, unknown>).pin_id), String(row.id)]));
    const added: { id: string; section: string }[] = [];
    for (let index = 0; index < pins.length; index += 4) {
      await Promise.all(pins.slice(index, index + 4).map(async pin => {
        const section = sectionName.get(pin.board_section_id || "") || "";
        const already = existing.get(pin.id);
        if (already) { skipped += 1; added.push({ id: already, section }); return; }
        const id = await saveImage(db, ownerId, pin, board, section).catch(() => null);
        if (id) { imported += 1; added.push({ id, section }); } else failed += 1;
      }));
    }
    if (added.length) await db.from("collection_items").upsert(added.map(item => ({ owner_id: ownerId, collection_id: collectionId, record_type: "media", record_id: item.id, ...(item.section ? { note: item.section } : {}) })), { onConflict: "collection_id,record_type,record_id", ignoreDuplicates: true });
    if (!page.bookmark) { done = true; bookmark = ""; break; }
    bookmark = page.bookmark;
  }
  return { imported, skipped, failed, bookmark, done, collectionId };
}
