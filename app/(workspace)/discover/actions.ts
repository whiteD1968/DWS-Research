"use server";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { searchDiscover } from "@/lib/discover/search";
import type { DiscoverFilters, ResearchSession } from "@/lib/discover/types";
import { revalidatePath } from "next/cache";
import { normalizeUrl } from "@/lib/discover/normalize";
import { createDiscoverSnapshot } from "@/lib/discover/snapshot";

export async function runDiscover(query: string, filters: DiscoverFilters): Promise<{ session?: ResearchSession; error?: string }> {
  const user = await requireUser();
  try {
    const results = await searchDiscover(query, filters);
    const db = await createClient();
    const { data, error } = await db.from("research_sessions").insert({ owner_id: user.id,
      title: query.trim().slice(0, 120), query: query.trim(), filters, result_snapshot: createDiscoverSnapshot(results) }).select().single();
    if (error) return { error: "Search completed, but the session could not be saved. Check that the Discover migration is installed and retry." };
    revalidatePath("/discover");
    return { session: data as ResearchSession };
  } catch (error) { return { error: error instanceof Error ? error.message : "Search failed. Please try again." }; }
}

export async function importDiscover(sessionId: string, ids: string[], collectionId?: string, collectionTitle?: string) {
  await requireUser();
  try {
    const db = await createClient();
    const sourceMatches: Record<string, string> = {};
    for (let offset = 0; ; offset += 500) {
      const { data: sources, error: sourceError } = await db.from("sources").select("id,url").order("id").range(offset, offset + 499);
      if (sourceError) return { error: "Existing sources could not be checked. Please retry." };
      for (const source of sources ?? []) {
        const url = normalizeUrl(source.url ?? "");
        if (url) sourceMatches[url] ??= source.id;
      }
      if (!sources || sources.length < 500) break;
    }
    const { data, error } = await db.rpc("import_discover_results", {
      session_id: sessionId, result_ids: ids, collection_id: collectionId || null, collection_title: collectionTitle || null,
      source_matches: sourceMatches,
    });
    if (error) return { error: "The selected results could not be saved. Nothing in this batch was imported. Please retry." };
    for (const path of ["/discover", "/library", "/library/references", "/collections"]) revalidatePath(path);
    if (data.collectionId) revalidatePath(`/collections/${data.collectionId}`);
    revalidatePath(`/discover/sessions/${sessionId}`);
    return { savedItems: data.savedItems as Record<string, string>, collectionId: data.collectionId as string | null };
  } catch { return { error: "Unable to save this selection. Please retry." }; }
}
