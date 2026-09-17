import type { DiscoverResult } from "./types";

// Explicit persistence boundary: provider payloads must not flow into sessions.
// Retention policies can reduce these fields independently of search adapters.
export function createDiscoverSnapshot(results: DiscoverResult[]): DiscoverResult[] {
  return results.map(result => {
    const metadata: Record<string, unknown> = {};
    for (const key of ["provider", "provider_rank", "classification", "classificationEvidence", "sourceType", "relevanceScore", "scoreBreakdown", "penalties", "rankingVersion", "rankingMode", "originalRank"]) {
      if (result.metadata?.[key] !== undefined) metadata[key] = result.metadata[key];
    }
    return {
      id: result.id, provider: result.provider, origin: result.origin, resultType: result.resultType,
      title: result.title, subtitle: result.subtitle, summary: result.summary, url: result.url,
      sourceName: result.sourceName, publishedAt: result.publishedAt, creator: result.creator,
      location: result.location, imageUrl: result.imageUrl, thumbnailUrl: result.thumbnailUrl,
      sourcePageUrl: result.sourcePageUrl, imageWidth: result.imageWidth, imageHeight: result.imageHeight,
      relevanceReason: result.relevanceReason, metadata,
    };
  });
}
