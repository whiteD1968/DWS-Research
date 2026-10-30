import type { SupabaseClient } from "@supabase/supabase-js";
import { itemsUrl, zoteroMaxPerRun, zoteroPageSize, zoteroParent, zoteroRecord, zoteroSettingsFrom, type ZoteroItem } from "@/lib/zotero";

type Row = NonNullable<ReturnType<typeof zoteroRecord>>;

async function zoteroFetch(url: string, apiKey: string) {
  const response = await fetch(url, { headers: { "Zotero-API-Key": apiKey, "Zotero-API-Version": "3" }, cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (response.status === 403) throw new Error("Zotero turned down the API key. Check that it can read your library.");
  if (response.status === 404) throw new Error("Zotero couldn’t find that user ID or collection.");
  if (response.status === 429 || response.status === 503) throw new Error("Zotero is busy right now. The next sync will pick up from here.");
  if (!response.ok) throw new Error("Zotero didn’t answer. The next sync will try again.");
  return { items: (await response.json()) as ZoteroItem[], version: Number(response.headers.get("Last-Modified-Version")) || 0 };
}

// New items become a source plus a reference; items seen before update in place, keeping anything added on the site.
async function save(db: SupabaseClient, ownerId: string, rows: Row[]) {
  if (!rows.length) return { added: 0, updated: 0 };
  const { data: sources, error } = await db.from("sources").select("id,zotero_item_key").eq("owner_id", ownerId).in("zotero_item_key", rows.map(row => row.key));
  if (error) throw new Error("Could not read existing references.");
  const sourceByKey = new Map((sources || []).map(source => [source.zotero_item_key as string, source.id as string]));
  const { data: refs } = sourceByKey.size ? await db.from("references").select("id,primary_source_id,metadata").eq("owner_id", ownerId).in("primary_source_id", [...sourceByKey.values()]) : { data: [] };
  const refBySource = new Map((refs || []).map(ref => [ref.primary_source_id as string, ref as { id: string; metadata: Record<string, unknown> | null }]));

  const fresh = rows.filter(row => !sourceByKey.has(row.key));
  if (fresh.length) {
    const { data: made, error: sourceError } = await db.from("sources").insert(fresh.map(row => ({ owner_id: ownerId, ...row.source }))).select("id,zotero_item_key");
    if (sourceError || !made) throw new Error("Could not save the new Zotero items.");
    const madeByKey = new Map(made.map(source => [source.zotero_item_key as string, source.id as string]));
    const { error: refError } = await db.from("references").insert(fresh.map(row => ({ owner_id: ownerId, ...row.reference, primary_source_id: madeByKey.get(row.key) })));
    if (refError) throw new Error("Could not save the new Zotero items.");
  }
  let updated = 0;
  for (const row of rows.filter(item => sourceByKey.has(item.key))) {
    const sourceId = sourceByKey.get(row.key)!;
    await db.from("sources").update(row.source).eq("owner_id", ownerId).eq("id", sourceId);
    const ref = refBySource.get(sourceId);
    if (ref) await db.from("references").update({ ...row.reference, metadata: { ...(ref.metadata || {}), ...row.reference.metadata } }).eq("owner_id", ownerId).eq("id", ref.id);
    else await db.from("references").insert({ owner_id: ownerId, ...row.reference, primary_source_id: sourceId });
    updated += 1;
  }
  return { added: fresh.length, updated };
}

// Pulls whatever changed in Zotero since the last library version. Works with the signed-in client or the service client.
export async function syncZoteroFor(db: SupabaseClient, ownerId: string) {
  const { data: settingsRow, error } = await db.from("notes").select("id,metadata").eq("owner_id", ownerId).eq("parent_type", zoteroParent).order("created_at").limit(1).maybeSingle();
  if (error || !settingsRow) throw new Error("Connect Zotero first.");
  const settings = zoteroSettingsFrom(settingsRow.metadata);
  if (!settings.userId || !settings.apiKey) throw new Error("Connect Zotero first.");

  let start = settings.resumeStart; let libraryVersion = 0; let added = 0; let updated = 0; let fetched = 0; let complete = false; let failure = "";
  try {
    while (fetched < zoteroMaxPerRun) {
      const page = await zoteroFetch(itemsUrl(settings, settings.version, start), settings.apiKey);
      libraryVersion ||= page.version;
      const result = await save(db, ownerId, page.items.map(zoteroRecord).filter((row): row is Row => !!row));
      added += result.added; updated += result.updated; fetched += page.items.length; start += page.items.length;
      if (page.items.length < zoteroPageSize) { complete = true; break; }
    }
  } catch (problem) { failure = problem instanceof Error ? problem.message : "Sync failed."; }

  const { count } = await db.from("sources").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("source_type", "zotero");
  const meta = (settingsRow.metadata || {}) as Record<string, unknown>;
  await db.from("notes").update({ metadata: {
    ...meta,
    ...(complete ? { version: libraryVersion || settings.version, resume_start: 0 } : { resume_start: start }),
    last_sync: new Date().toISOString(), last_error: failure || null, imported: count ?? settings.imported,
  } }).eq("owner_id", ownerId).eq("id", settingsRow.id);
  if (failure && !added && !updated) throw new Error(failure);
  return { added, updated, complete, failure };
}
