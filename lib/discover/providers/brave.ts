import type { DiscoverFilters, DiscoverResult, SearchProvider } from "../types";
import { normalizeUrl } from "../normalize";
import { buildDiscoverQuery, discoverFreshness } from "../query";
import { imageDimension, safeImageUrl } from "../images";

type WebResult = { title?: string; url?: string; description?: string; page_age?: string;
  profile?: { name?: string }; thumbnail?: { src?: string; original?: string } };
const plain = (text?: string) => text?.replace(/<[^>]*>/g, "").slice(0, 2000);
type ImageResult = { title?: string; url?: string; source?: string; thumbnail?: { src?: string }; properties?: { url?: string; width?: number; height?: number } };

export class BraveSearchProvider implements SearchProvider {
  async search(query: string, filters: DiscoverFilters): Promise<DiscoverResult[]> {
    const key = process.env.BRAVE_SEARCH_API_KEY;
    if (!key) throw new Error("Web search is not configured. Ask the workspace administrator to configure the search provider.");
    const images = filters.contentType === "image";
    const endpoint = new URL(`https://api.search.brave.com/res/v1/${images ? "images" : "web"}/search`);
    const refined = buildDiscoverQuery(query, filters);
    if (images && (refined.length > 400 || refined.split(/\s+/).length > 50)) throw new Error("Use a shorter image query (up to 400 characters and 50 words, including Focus).");
    endpoint.searchParams.set("q", refined);
    endpoint.searchParams.set("count", images ? "50" : "20");
    if (images) endpoint.searchParams.set("safesearch", "strict");
    else endpoint.searchParams.set("text_decorations", "false");
    const freshness = discoverFreshness(filters);
    if (freshness && !images) endpoint.searchParams.set("freshness", freshness);
    const response = await fetch(endpoint, { headers: { "X-Subscription-Token": key }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(response.status === 429 ? "Search is busy. Please try again shortly." : images && [401, 403].includes(response.status) ? "Image search is not enabled for the configured Brave API key. Ask the workspace administrator to check image-search access." : "The search provider could not complete this search. Please try again.");
    const body = await response.json() as { web?: { results?: WebResult[] }; results?: ImageResult[] };
    if (images) {
      if (!body || !Array.isArray(body.results)) throw new Error("The image search provider returned an invalid response.");
      const seen = new Set<string>();
      return body.results.slice(0, 50).flatMap((item): DiscoverResult[] => {
        if (!item || typeof item !== "object") return [];
        const imageUrl = safeImageUrl(item.properties?.url);
        const sourcePageUrl = normalizeUrl(item.url || "");
        if (!imageUrl || !sourcePageUrl || seen.has(imageUrl)) return [];
        seen.add(imageUrl);
        return [{ id: `brave-image:${imageUrl}`, provider: "brave", origin: "external", resultType: "image",
          title: typeof item.title === "string" && plain(item.title)?.trim() ? plain(item.title)! : `Image from ${new URL(sourcePageUrl).hostname}`,
          url: imageUrl, sourcePageUrl, imageUrl, thumbnailUrl: safeImageUrl(item.thumbnail?.src),
          imageWidth: imageDimension(item.properties?.width), imageHeight: imageDimension(item.properties?.height),
          sourceName: new URL(sourcePageUrl).hostname, relevanceReason: "Image match from Brave Search.", metadata: { provider: "brave", provider_rank: seen.size } }];
      });
    }
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
