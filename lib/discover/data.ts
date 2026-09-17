import { createClient } from "@/lib/supabase/server";
import { normalizeUrl } from "./normalize";
import type { DiscoverResult } from "./types";

export async function discoverLibrary(ownerId: string, results: DiscoverResult[] = []) {
  const db = await createClient();
  const { data: collections, error } = await db.from("collections").select("id,title").eq("owner_id", ownerId).order("title");
  const { data: topics } = await db.from("research_threads").select("id,title").eq("owner_id", ownerId).order("title");
  // Exact normalized titles and canonical URLs deliberately avoid fuzzy false positives.
  const matches: Record<string, string> = {};
  if (results.length) {
    let offset = 0;
    for (;;) {
      const { data, error: readError } = await db.from("references").select("id,title,reference_type,metadata,sources:primary_source_id(url)")
        .eq("owner_id", ownerId).order("id").range(offset, offset + 499);
      if (readError) break;
      for (const reference of data ?? []) {
        const source = reference.sources as unknown as { url?: string } | null;
        for (const result of results) {
          if (source?.url === result.url || normalizeUrl(source?.url ?? "") === result.url || reference.metadata?.normalized_url === result.url ||
            (result.resultType !== "image" && reference.reference_type !== "image" && reference.metadata?.original_result_type !== "image" && reference.title.toLowerCase().replace(/[\s\p{P}]+/gu, "") === result.title.toLowerCase().replace(/[\s\p{P}]+/gu, ""))) matches[result.id] = reference.id;
        }
      }
      if (!data || data.length < 500) break;
      offset += 500;
    }
  }
  return { collections: collections ?? [], topics: topics ?? [], matches, error: error ? "Collections could not be loaded." : undefined };
}
