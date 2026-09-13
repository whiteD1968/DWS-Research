export type DiscoverResult = {
  id: string;
  provider: string;
  origin: "external" | "internal";
  resultType: "project" | "article" | "paper" | "studio" | "lab" | "video" | "image" | "vendor" | "product" | "other";
  title: string;
  subtitle?: string;
  summary?: string;
  url: string;
  sourceName?: string;
  publishedAt?: string;
  creator?: string;
  location?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
  relevanceReason?: string;
};
export type DiscoverMode = "all" | "project" | "paper" | "lab" | "video";
export type DiscoverFilters = { freshness: string; contentType: string; topic: string; yearFrom?: string; yearTo?: string };
export type ResearchSession = {
  id: string; title: string; query: string; filters: DiscoverFilters;
  result_snapshot: DiscoverResult[]; saved_items: Record<string, string>; created_at: string;
};
export interface SearchProvider {
  search(query: string, filters: DiscoverFilters): Promise<DiscoverResult[]>;
}
