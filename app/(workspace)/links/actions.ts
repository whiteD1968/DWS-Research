"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchPageInfo, inBatches } from "@/lib/weblink-fetch";
import { allWeblinkRows } from "@/lib/weblink-store";
import { smartTagLimit, smartTags } from "@/lib/weblink-tagger";
import { autoTags, batchLabel, cleanUrl, domainOf, linkKey, maxImport, mergeTags, parseTags, weblinkFrom, weblinkParent, weblinkProjectType, type LinkDraft } from "@/lib/weblinks";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Meta = Record<string, unknown>;
function done(projectIds: string[] = []) { revalidatePath("/links"); for (const id of projectIds) revalidatePath(`/projects/${id}`); }
const idList = (ids: unknown) => (Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === "string" && uuid.test(id)))].slice(0, 1000) : []);

// Long id lists go in pieces so each request's address stays short.
const chunks = <T,>(items: T[], size = 150) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

async function ownOrigin() {
  const list = await headers(); const host = list.get("x-forwarded-host") || list.get("host");
  return host ? `${list.get("x-forwarded-proto") || "https"}://${host}` : "";
}

async function ownedLinks(ids: string[]) {
  const user = await requireUser(); const db = await createClient();
  if (!ids.length) return { user, db, rows: [] as { id: string; title: string | null; plain_text: string | null; metadata: Meta }[] };
  const rows: { id: string; title: string | null; plain_text: string | null; metadata: Meta }[] = [];
  for (const part of chunks(ids)) {
    const { data, error } = await db.from("notes").select("id,title,plain_text,metadata").eq("owner_id", user.id).eq("parent_type", weblinkParent).in("id", part);
    if (error) throw new Error("Those links could not be loaded. Please retry.");
    rows.push(...((data || []) as typeof rows));
  }
  return { user, db, rows };
}

async function ownedProject(db: Awaited<ReturnType<typeof createClient>>, ownerId: string, projectId: string) {
  if (!uuid.test(projectId)) throw new Error("Choose a project.");
  const { data } = await db.from("projects").select("id").eq("owner_id", ownerId).eq("id", projectId).maybeSingle();
  if (!data) throw new Error("That project is unavailable.");
}

// Fills in titles, descriptions, preview images, and the frame check for freshly saved links, a few at a time.
async function enrich(db: Awaited<ReturnType<typeof createClient>>, ownerId: string, rows: { id: string; title: string | null; metadata: Meta }[], budgetMs: number) {
  const origin = await ownOrigin();
  return inBatches(rows, 8, budgetMs, async row => {
    const meta = row.metadata;
    const info = await fetchPageInfo(String(meta.url), origin, 6000);
    if (!info) { await db.from("notes").update({ metadata: { ...meta, frame: "unknown", checked_at: new Date().toISOString() } }).eq("owner_id", ownerId).eq("id", row.id); return; }
    const title = row.title || info.title || null;
    const tags = meta.auto === false ? parseTags(meta.tags) : mergeTags(parseTags(meta.tags), autoTags(String(meta.url), title || "", info.description));
    await db.from("notes").update({ title, metadata: { ...meta, tags, description: info.description, site_name: info.siteName, image: info.image, frame: info.frame, checked_at: new Date().toISOString() } }).eq("owner_id", ownerId).eq("id", row.id);
  });
}

export type ImportResult = { added: number; skipped: number; ids: string[] };

// Saves a batch of links (a window of Chrome tabs, a pasted list, or a bookmarks file), skipping any already saved.
export async function importLinks(drafts: LinkDraft[], options: { tags?: string[]; projectId?: string; auto?: boolean; batch?: string } = {}): Promise<ImportResult> {
  const user = await requireUser(); const db = await createClient();
  const auto = options.auto !== false;
  const extraTags = parseTags(options.tags);
  if (options.projectId) await ownedProject(db, user.id, options.projectId);
  const cleaned = (Array.isArray(drafts) ? drafts : []).slice(0, maxImport).flatMap(draft => {
    const url = draft && typeof draft.url === "string" ? cleanUrl(draft.url) : null;
    return url ? [{ url, key: linkKey(url), title: typeof draft.title === "string" ? draft.title.replace(/\s+/g, " ").trim().slice(0, 300) : "" }] : [];
  });
  if (!cleaned.length) throw new Error("No web addresses found. Paste one link per line, or links with titles.");
  const { rows: existing, error: loadError } = await allWeblinkRows<{ id: string; key: string | null }>(db, user.id, "id,key:metadata->>key");
  if (loadError) throw new Error("Could not check for links you've already saved. Please retry.");
  const known = new Map(existing.flatMap(row => (row.key ? [[row.key, row.id] as const] : [])));
  const seen = new Set<string>();
  const fresh = cleaned.filter(item => !known.has(item.key) && !seen.has(item.key) && seen.add(item.key));
  const batch = (typeof options.batch === "string" && options.batch.trim().slice(0, 80)) || batchLabel();
  const savedAt = new Date().toISOString();
  const rows = fresh.map(item => ({
    owner_id: user.id, parent_type: weblinkParent, title: item.title || null, plain_text: "", content: [],
    metadata: { url: item.url, key: item.key, domain: domainOf(item.url), tags: mergeTags(extraTags, auto ? autoTags(item.url, item.title) : []), auto, saved_at: savedAt, batch, frame: "unknown" },
  }));
  let inserted: { id: string; title: string | null; metadata: Meta }[] = [];
  if (rows.length) {
    const { data, error } = await db.from("notes").insert(rows).select("id,title,metadata");
    if (error || !data) throw new Error("Could not save the links. Please retry.");
    inserted = data as typeof inserted;
  }
  // Links that were already saved still join the chosen project.
  const allIds = [...inserted.map(row => row.id), ...cleaned.flatMap(item => (known.has(item.key) ? [known.get(item.key)!] : []))];
  if (options.projectId && allIds.length) await linkRows(db, user.id, [...new Set(allIds)], options.projectId);
  await enrich(db, user.id, inserted, 25000);
  done(options.projectId ? [options.projectId] : []);
  return { added: inserted.length, skipped: cleaned.length - inserted.length, ids: allIds };
}

// Checks a link again: its title and preview, and whether it can open inside the site.
export async function refreshLink(id: string) {
  const { user, db, rows } = await ownedLinks(idList([id]));
  if (!rows.length) throw new Error("That link is unavailable.");
  await enrich(db, user.id, rows.map(row => ({ ...row, title: null })), 9000);
  done();
}

export async function saveLink(id: string, values: { title?: string; url?: string; notes?: string; tags?: string[] }) {
  const { user, db, rows } = await ownedLinks(idList([id]));
  const row = rows[0];
  if (!row) throw new Error("That link is unavailable.");
  const meta = { ...row.metadata };
  if (typeof values.url === "string" && values.url.trim() && values.url.trim() !== meta.url) {
    const url = cleanUrl(values.url);
    if (!url) throw new Error("That web address doesn't look right.");
    Object.assign(meta, { url, key: linkKey(url), domain: domainOf(url), frame: "unknown", description: "", image: "", site_name: "" });
  }
  if (values.tags) meta.tags = parseTags(values.tags);
  const title = typeof values.title === "string" ? values.title.trim().slice(0, 300) || null : row.title;
  const notes = typeof values.notes === "string" ? values.notes.slice(0, 20000) : row.plain_text;
  const { error } = await db.from("notes").update({ title, plain_text: notes, metadata: meta }).eq("owner_id", user.id).eq("id", row.id);
  if (error) throw new Error("Could not save. Please retry.");
  done();
}

export async function tagLinks(ids: string[], add: string[], remove: string[] = []) {
  const { user, db, rows } = await ownedLinks(idList(ids));
  const adding = parseTags(add); const removing = new Set(parseTags(remove).map(tag => tag.toLowerCase()));
  if (!adding.length && !removing.size) throw new Error("Type a tag first.");
  for (const row of rows) {
    const tags = mergeTags(parseTags(row.metadata.tags).filter(tag => !removing.has(tag.toLowerCase())), adding);
    const { error } = await db.from("notes").update({ metadata: { ...row.metadata, tags } }).eq("owner_id", user.id).eq("id", row.id);
    if (error) throw new Error("Could not update the tags. Please retry.");
  }
  done();
}

// Asks Claude for topic tags, keeping the spelling of tags already in use.
export async function smartTagLinks(ids: string[]) {
  const { user, db, rows } = await ownedLinks(idList(ids).slice(0, smartTagLimit));
  if (!rows.length) throw new Error("Select some links first.");
  const { rows: all } = await allWeblinkRows<{ tags: unknown }>(db, user.id, "tags:metadata->tags");
  const existing = new Map<string, string>();
  for (const item of all) for (const tag of parseTags(item.tags)) existing.set(tag.toLowerCase(), tag);
  const links = rows.map(row => weblinkFrom(row)!).filter(Boolean);
  const suggested = await smartTags(links, [...existing.values()]);
  let tagged = 0;
  for (const [index, row] of rows.entries()) {
    const extra = (suggested[index] || []).map(tag => existing.get(tag.toLowerCase()) || tag);
    if (!extra.length) continue;
    const tags = mergeTags(parseTags(row.metadata.tags), extra);
    const { error } = await db.from("notes").update({ metadata: { ...row.metadata, tags } }).eq("owner_id", user.id).eq("id", row.id);
    if (!error) tagged += 1;
  }
  done();
  return tagged;
}

async function linkRows(db: Awaited<ReturnType<typeof createClient>>, ownerId: string, ids: string[], projectId: string) {
  const { error } = await db.from("relationships").upsert(ids.map(id => ({ owner_id: ownerId, source_type: "note", source_id: id, relationship_type: weblinkProjectType, target_type: "project", target_id: projectId, metadata: {} })), { onConflict: "source_type,source_id,relationship_type,target_type,target_id", ignoreDuplicates: true });
  if (error) throw new Error("Could not add the links to the project. Please retry.");
}

export async function addLinksToProject(ids: string[], projectId: string) {
  const { user, db, rows } = await ownedLinks(idList(ids));
  if (!rows.length) throw new Error("Select some links first.");
  await ownedProject(db, user.id, projectId);
  await linkRows(db, user.id, rows.map(row => row.id), projectId);
  done([projectId]);
  return rows.length;
}

export async function removeLinkFromProject(id: string, projectId: string) {
  if (!uuid.test(id) || !uuid.test(projectId)) throw new Error("That link is unavailable.");
  const user = await requireUser(); const db = await createClient();
  const { error } = await db.from("relationships").delete().eq("owner_id", user.id).eq("source_type", "note").eq("source_id", id).eq("relationship_type", weblinkProjectType).eq("target_id", projectId);
  if (error) throw new Error("Could not remove it from the project. Please retry.");
  done([projectId]);
}

export async function deleteLinks(ids: string[]) {
  const { user, db, rows } = await ownedLinks(idList(ids));
  if (!rows.length) return 0;
  const found = rows.map(row => row.id);
  const projects = new Set<string>();
  for (const part of chunks(found)) {
    const { data: rels } = await db.from("relationships").select("target_id").eq("owner_id", user.id).eq("source_type", "note").eq("relationship_type", weblinkProjectType).in("source_id", part);
    for (const rel of rels || []) projects.add(rel.target_id as string);
    await db.from("relationships").delete().eq("owner_id", user.id).eq("source_type", "note").in("source_id", part);
    const { error } = await db.from("notes").delete().eq("owner_id", user.id).eq("parent_type", weblinkParent).in("id", part);
    if (error) throw new Error("Could not delete all of the links. Please retry.");
  }
  done([...projects]);
  return found.length;
}

export async function markLinksOpened(ids: string[]) {
  const { user, db, rows } = await ownedLinks(idList(ids).slice(0, 100));
  const at = new Date().toISOString();
  await Promise.all(rows.filter(row => !row.metadata.opened_at).map(row => db.from("notes").update({ metadata: { ...row.metadata, opened_at: at } }).eq("owner_id", user.id).eq("id", row.id)));
  if (rows.length) revalidatePath("/links");
}
