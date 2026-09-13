import type { DiscoverFilters, DiscoverResult, SearchProvider } from "../types";
import { normalizeUrl } from "../normalize";
import { buildDiscoverQuery, discoverFreshness } from "../query";

type WebResult = { title?: string; url?: string; description?: string; page_age?: string;
  profile?: { name?: string }; thumbnail?: { src?: string; original?: string } };
const plain = (text?: string) => text?.replace(/<[^>]*>/g, "").slice(0, 2000);

export class BraveSearchProvider implements SearchProvider {
  async search(query: string, filters: DiscoverFilters): Promise<DiscoverResult[]> {
    const key = process.env.BRAVE_SEARCH_API_KEY;
    if (!key) throw new Error("Web search is not configured. Ask the workspace administrator to configure the search provider.");
    const endpoint = new URL("https://api.search.brave.com/res/v1/web/search");
    endpoint.searchParams.set("q", buildDiscoverQuery(query, filters));
    endpoint.searchParams.set("count", "20");
    endpoint.searchParams.set("text_decorations", "false");
    const freshness = discoverFreshness(filters);
    if (freshness) endpoint.searchParams.set("freshness", freshness);
    const response = await fetch(endpoint, { headers: { "X-Subscription-Token": key }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(response.status === 429 ? "Search is busy. Please try again shortly." : "The search provider could not complete this search. Please try again.");
    const body = await response.json() as { web?: { results?: WebResult[] } };
    if (body.web?.results && !Array.isArray(body.web.results)) throw new Error("The search provider returned an invalid response.");
    const seen = new Set<string>();
    return (body.web?.results ?? []).flatMap((item): DiscoverResult[] => {
      const url = normalizeUrl(item.url ?? "");
      if (!url || !item.title || seen.has(url)) return [];
      seen.add(url);
      return [{ id: `brave:${url}`, provider: "brave", origin: "external", resultType: "article",
        title: plain(item.title)!, url, summary: plain(item.description),
        sourceName: item.profile?.name ?? new URL(url).hostname,
        publishedAt: item.page_age, thumbnailUrl: normalizeUrl(item.thumbnail?.src ?? "") ?? undefined,
        imageUrl: normalizeUrl(item.thumbnail?.original ?? "") ?? undefined,
        relevanceReason: "Ranked by Brave Search for this research question.",
        metadata: { provider: "brave", provider_rank: seen.size } }];
    });
  }
}
