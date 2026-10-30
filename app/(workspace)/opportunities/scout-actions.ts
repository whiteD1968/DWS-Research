"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { studioToday } from "@/lib/journal";
import { defaultMaterials, opportunityParent, reminderFor } from "@/lib/opportunities";
import { defaultSearches, guessDeadline, guessKind, leadFrom, leadKey, leadParent, parseSearches, scoutDue, scoutSettingsParent } from "@/lib/opportunity-scout";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Db = Awaited<ReturnType<typeof createClient>>;
type Hit = { title: string; url: string; description: string; source: string };

async function settings(db: Db, ownerId: string) {
  const { data } = await db.from("notes").select("id,metadata").eq("owner_id", ownerId).eq("parent_type", scoutSettingsParent).order("created_at").limit(1).maybeSingle();
  if (data) return { id: data.id as string, meta: (data.metadata || {}) as Record<string, unknown> };
  const meta = { searches: defaultSearches, seen: [] as string[], last_run: null };
  const { data: made, error } = await db.from("notes").insert({ owner_id: ownerId, title: "Opportunity scout settings", parent_type: scoutSettingsParent, plain_text: "", content: [], metadata: meta }).select("id").single();
  if (error || !made) throw new Error("Could not open the scout settings.");
  return { id: made.id as string, meta };
}

async function braveSearch(query: string): Promise<Hit[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) throw new Error("Web search isn't configured, so the scout can't run.");
  const endpoint = new URL("https://api.search.brave.com/res/v1/web/search");
  endpoint.searchParams.set("q", query); endpoint.searchParams.set("count", "10"); endpoint.searchParams.set("freshness", "pm"); endpoint.searchParams.set("text_decorations", "false");
  const response = await fetch(endpoint, { headers: { "X-Subscription-Token": key }, cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(response.status === 429 ? "Search is busy right now; the scout will try again later." : "The search provider didn't answer; the scout will try again later.");
  const body = await response.json() as { web?: { results?: { title?: string; url?: string; description?: string; profile?: { name?: string } }[] } };
  const plain = (text?: string) => (text || "").replace(/<[^>]*>/g, "").trim();
  return (body.web?.results || []).flatMap(item => item.url && item.title && /^https?:\/\//.test(item.url) ? [{ title: plain(item.title).slice(0, 300), url: item.url, description: plain(item.description).slice(0, 1000), source: plain(item.profile?.name) || new URL(item.url).hostname.replace(/^www\./, "") }] : []);
}

// Runs at most every scoutIntervalHours unless forced; the run time is written first so two open tabs can't both search.
export async function runScout(force = false) {
  const user = await requireUser(); const db = await createClient();
  const { id, meta } = await settings(db, user.id);
  if (!force && !scoutDue(meta.last_run)) return { ran: false, added: 0 };
  await db.from("notes").update({ metadata: { ...meta, last_run: new Date().toISOString() } }).eq("owner_id", user.id).eq("id", id);
  const searches = parseSearches(meta.searches);
  const { data: known } = await db.from("notes").select("metadata").eq("owner_id", user.id).in("parent_type", [opportunityParent, leadParent]).limit(3000);
  const seen = new Set<string>([...(Array.isArray(meta.seen) ? meta.seen.map(String) : []), ...(known || []).map(row => leadKey(String((row.metadata as { url?: unknown })?.url || ""))).filter(Boolean)]);
  const today = studioToday(); const fresh: Record<string, unknown>[] = []; const newKeys: string[] = [];
  let failure = "";
  for (const [index, query] of searches.entries()) {
    if (index) await new Promise(resolve => setTimeout(resolve, 1100));
    let hits: Hit[] = [];
    try { hits = await braveSearch(query); } catch (error) { failure = error instanceof Error ? error.message : "Search failed."; break; }
    for (const hit of hits) {
      const key = leadKey(hit.url);
      if (!key || seen.has(key)) continue;
      seen.add(key); newKeys.push(key);
      const text = `${hit.title} ${hit.description}`;
      const { deadline, past } = guessDeadline(text, today);
      if (past) continue;
      fresh.push({ owner_id: user.id, title: hit.title, plain_text: hit.description, parent_type: leadParent, content: [], metadata: { url: hit.url, source: hit.source, query, found_at: new Date().toISOString(), deadline, kind: guessKind(text) } });
    }
  }
  const added = fresh.slice(0, 20);
  if (added.length) {
    const { error } = await db.from("notes").insert(added);
    if (error) throw new Error("The scout found new leads but couldn't save them. It will try again later.");
  }
  const { data: latest } = await db.from("notes").select("metadata").eq("owner_id", user.id).eq("id", id).maybeSingle();
  const current = (latest?.metadata || meta) as Record<string, unknown>;
  const kept = [...(Array.isArray(current.seen) ? current.seen.map(String) : []), ...newKeys].slice(-2000);
  await db.from("notes").update({ metadata: { ...current, seen: kept, last_error: failure || null } }).eq("owner_id", user.id).eq("id", id);
  if (added.length) { revalidatePath("/"); revalidatePath("/opportunities"); }
  if (failure && force) throw new Error(failure);
  return { ran: true, added: added.length };
}

export async function saveScoutSearches(text: string) {
  const searches = parseSearches(text);
  if (!searches.length) throw new Error("Add at least one search.");
  const user = await requireUser(); const db = await createClient();
  const { id, meta } = await settings(db, user.id);
  const { error } = await db.from("notes").update({ metadata: { ...meta, searches, last_run: null } }).eq("owner_id", user.id).eq("id", id);
  if (error) throw new Error("Could not save the searches.");
  revalidatePath("/opportunities");
}

// Tracking turns the lead into an ordinary opportunity, keeping its link and any deadline the scout spotted.
export async function trackLead(id: string) {
  if (!uuid.test(id)) throw new Error("That lead is unavailable.");
  const user = await requireUser(); const db = await createClient();
  const { data } = await db.from("notes").select("id,title,plain_text,metadata").eq("owner_id", user.id).eq("parent_type", leadParent).eq("id", id).maybeSingle();
  const lead = data && leadFrom(data);
  if (!lead) throw new Error("That lead is unavailable. Refresh and try again.");
  const remindAt = reminderFor(lead.deadline, studioToday());
  const metadata = { kind: lead.kind, organization: lead.source, location: "", deadline: lead.deadline, url: lead.url, fee: "", award: "", status: "interested", materials: defaultMaterials(lead.kind), ...(remindAt ? { remind_at: remindAt } : {}) };
  const { error } = await db.from("notes").update({ parent_type: opportunityParent, metadata }).eq("owner_id", user.id).eq("id", id);
  if (error) throw new Error("Could not track that lead. Please retry.");
  revalidatePath("/"); revalidatePath("/opportunities");
}

export async function dismissLeads(ids: string[]) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 || !ids.every(id => uuid.test(id))) throw new Error("Nothing to dismiss.");
  const user = await requireUser(); const db = await createClient();
  const { error } = await db.from("notes").delete().eq("owner_id", user.id).eq("parent_type", leadParent).in("id", ids);
  if (error) throw new Error("Could not dismiss. Please retry.");
  revalidatePath("/"); revalidatePath("/opportunities");
}
