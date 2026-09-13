import { BraveSearchProvider } from "./providers/brave";
import type { DiscoverFilters, SearchProvider } from "./types";

export async function searchDiscover(query: string, filters: DiscoverFilters, provider: SearchProvider = new BraveSearchProvider()) {
  if (!query.trim() || query.length > 400) throw new Error("Enter a research question of 1 to 400 characters.");
  if (!["", "pd", "pw", "pm", "py"].includes(filters.freshness) ||
      !["", "project", "paper", "studio", "lab", "video", "image"].includes(filters.contentType) ||
      !["", "architecture", "fabrication", "materials"].includes(filters.topic)) throw new Error("Invalid search filters.");
  return provider.search(query.trim(), filters);
}
