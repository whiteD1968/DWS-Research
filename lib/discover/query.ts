import { discoverMode } from "./rank";
import type { DiscoverFilters } from "./types";

export function buildDiscoverQuery(query: string, filters: DiscoverFilters) {
  const suffix = {
    all: "", project: "(project OR prototype OR pavilion OR case study)",
    paper: "(paper OR proceedings OR thesis OR DOI)", lab: "(research lab OR laboratory OR research group)",
    video: "(site:youtube.com OR site:vimeo.com)",
  }[discoverMode(filters.contentType)];
  return [query.trim(), filters.topic, suffix].filter(Boolean).join(" ");
}

export function discoverFreshness(filters: DiscoverFilters) {
  if (filters.yearFrom || filters.yearTo) return `${filters.yearFrom || "1900"}-01-01to${filters.yearTo || new Date().getFullYear()}-12-31`;
  return filters.freshness;
}
