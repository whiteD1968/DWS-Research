import { DiscoverProviderRouter } from "./providers/router";
import type { DiscoverFilters, SearchProvider } from "./types";
import { discoverMode, rankDiscoverResults } from "./rank";

export async function searchDiscover(query: string, filters: DiscoverFilters, provider: SearchProvider = new DiscoverProviderRouter()) {
  if (!query.trim() || query.length > 400) throw new Error("Enter a research question of 1 to 400 characters.");
  if (!["", "pd", "pw", "pm", "py"].includes(filters.freshness) ||
      !["", "all", "project", "paper", "studio", "lab", "video", "image", "scholarly", "book"].includes(filters.contentType) ||
      !["", "architecture", "fabrication", "materials"].includes(filters.topic)) throw new Error("Invalid search filters.");
  if (filters.contentType === "image" && (filters.freshness || filters.yearFrom || filters.yearTo)) throw new Error("Date filters are not available for image search. Clear them and try again.");
  if (["scholarly", "book"].includes(filters.contentType) && filters.freshness) throw new Error("Use From year and To year to limit articles and books by date.");
  const currentYear = new Date().getFullYear();
  // Book and article catalogs reach back centuries; web page dates do not.
  const earliest = ["scholarly", "book"].includes(filters.contentType) ? 1000 : 1900;
  for (const year of [filters.yearFrom, filters.yearTo]) {
    if (year && (!/^\d{4}$/.test(year) || Number(year) < earliest || Number(year) > currentYear)) throw new Error(`Use years between ${earliest} and ${currentYear}.`);
  }
  if (filters.yearFrom && filters.yearTo && filters.yearFrom > filters.yearTo) throw new Error("The start year must not follow the end year.");
  return rankDiscoverResults(await provider.search(query.trim(), filters), query, discoverMode(filters.contentType));
}
