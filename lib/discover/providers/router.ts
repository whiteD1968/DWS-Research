import type { DiscoverFilters, DiscoverResult, SearchProvider } from "../types";
import { discoverMode } from "../rank";
import { BraveSearchProvider } from "./brave";
import { OpenAlexProvider } from "./openalex";
import { OpenLibraryProvider } from "./openlibrary";
import { WikimediaCommonsProvider } from "./commons";
import { ArticProvider } from "./artic";

// Interleave several providers' lists so no single source fills the top of the page.
export function interleave(lists: DiscoverResult[][]) {
  const out: DiscoverResult[] = [];
  const seen = new Set<string>();
  for (let index = 0; lists.some(list => index < list.length); index += 1) {
    for (const list of lists) {
      const item = list[index];
      if (item && !seen.has(item.url)) { seen.add(item.url); out.push({ ...item, metadata: { ...item.metadata, provider_rank: out.length + 1 } }); }
    }
  }
  return out;
}

// Images combine Brave (when configured) with open collections, so image search works without a paid key.
export async function searchImages(query: string, filters: DiscoverFilters, providers: SearchProvider[]) {
  const settled = await Promise.allSettled(providers.map(provider => provider.search(query, filters)));
  const lists = settled.flatMap(outcome => outcome.status === "fulfilled" ? [outcome.value] : []);
  if (!lists.length) throw (settled[0] as PromiseRejectedResult).reason;
  return interleave(lists);
}

export class DiscoverProviderRouter implements SearchProvider {
  async search(query: string, filters: DiscoverFilters): Promise<DiscoverResult[]> {
    const mode = discoverMode(filters.contentType);
    if (mode === "scholarly") return new OpenAlexProvider().search(query, filters);
    if (mode === "book") return new OpenLibraryProvider().search(query, filters);
    if (mode === "image") return searchImages(query, filters, [
      new WikimediaCommonsProvider(), new ArticProvider(), ...(process.env.BRAVE_SEARCH_API_KEY ? [new BraveSearchProvider()] : []),
    ]);
    return new BraveSearchProvider().search(query, filters);
  }
}
