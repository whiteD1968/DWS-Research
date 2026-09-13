import { BraveSearchProvider } from "./providers/brave";
import type { DiscoverFilters, SearchProvider } from "./types";
import { discoverMode, rankDiscoverResults } from "./rank";

export async function searchDiscover(query: string, filters: DiscoverFilters, provider: SearchProvider = new BraveSearchProvider()) {
  if (!query.trim() || query.length > 400) throw new Error("Enter a research question of 1 to 400 characters.");
  if (!["", "pd", "pw", "pm", "py"].includes(filters.freshness) ||
      !["", "all", "project", "paper", "studio", "lab", "video", "image"].includes(filters.contentType) ||
      !["", "architecture", "fabrication", "materials"].includes(filters.topic)) throw new Error("Invalid search filters.");
  const currentYear = new Date().getFullYear();
  for (const year of [filters.yearFrom, filters.yearTo]) {
    if (year && (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > currentYear)) throw new Error(`Use years between 1900 and ${currentYear}.`);
  }
  if (filters.yearFrom && filters.yearTo && filters.yearFrom > filters.yearTo) throw new Error("The start year must not follow the end year.");
  return rankDiscoverResults(await provider.search(query.trim(), filters), query, discoverMode(filters.contentType));
}
