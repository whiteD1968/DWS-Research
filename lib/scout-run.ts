import type { SupabaseClient } from "@supabase/supabase-js";
import { studioToday } from "@/lib/journal";
import { opportunityParent } from "@/lib/opportunities";
import { cleanTitle, currentSearches, currentSkip, defaultSearches, defaultSkip, guessDeadline, looksLikeListing, guessKind, leadKey, leadParent, scoutDue, scoutSettingsParent, shouldSkip } from "@/lib/opportunity-scout";

type Db = SupabaseClient;
type Hit = { title: string; url: string; description: string; source: string };

export async function scoutSettings(db: Db, ownerId: string) {
  const { data } = await db.from("notes").select("id,metadata").eq("owner_id", ownerId).eq("parent_type", scoutSettingsParent).order("created_at").limit(1).maybeSingle();
  if (data) return { id: data.id as string, meta: (data.metadata || {}) as Record<string, unknown> };
  const meta = { searches: defaultSearches, skip: defaultSkip, seen: [] as string[], last_run: null };
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
// Takes any client scoped to the owner: the signed-in session from Home, or the service client from the morning job.
export async function scoutFor(db: Db, ownerId: string, force = false) {
  const { id, meta } = await scoutSettings(db, ownerId);
  if (!force && !scoutDue(meta.last_run)) return { ran: false, added: 0, failure: "" };
  await db.from("notes").update({ metadata: { ...meta, last_run: new Date().toISOString() } }).eq("owner_id", ownerId).eq("id", id);
  const searches = currentSearches(meta.searches); const skip = currentSkip(meta.skip);
  const { data: known } = await db.from("notes").select("metadata").eq("owner_id", ownerId).in("parent_type", [opportunityParent, leadParent]).limit(3000);
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
      if (past || looksLikeListing(hit.title) || shouldSkip(text, skip)) continue;
      fresh.push({ owner_id: ownerId, title: cleanTitle(hit.title, hit.source), plain_text: hit.description, parent_type: leadParent, content: [], metadata: { url: hit.url, source: hit.source, query, found_at: new Date().toISOString(), deadline, kind: guessKind(text) } });
    }
  }
  const added = fresh.slice(0, 20);
  if (added.length) {
    const { error } = await db.from("notes").insert(added);
    if (error) throw new Error("The scout found new leads but couldn't save them. It will try again later.");
  }
  const { data: latest } = await db.from("notes").select("metadata").eq("owner_id", ownerId).eq("id", id).maybeSingle();
  const current = (latest?.metadata || meta) as Record<string, unknown>;
  const kept = [...(Array.isArray(current.seen) ? current.seen.map(String) : []), ...newKeys].slice(-2000);
  await db.from("notes").update({ metadata: { ...current, seen: kept, last_error: failure || null } }).eq("owner_id", ownerId).eq("id", id);
  if (failure && force) throw new Error(failure);
  return { ran: true, added: added.length, failure };
}
