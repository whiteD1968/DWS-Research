import type { DiscoverFilters, DiscoverResult, SearchProvider } from "../types";
import type { CitationData } from "../../citation";
import { doiUrl, parseCitationDate, parsePersonName } from "../../citation";
import { normalizeUrl } from "../normalize";

// OpenAlex: free index of scholarly works (https://docs.openalex.org). No key required.
type Work = {
  id?: string; doi?: string | null; display_name?: string | null; title?: string | null; publication_year?: number | null; publication_date?: string | null;
  type?: string | null; authorships?: { author?: { display_name?: string | null }; raw_author_name?: string | null }[];
  primary_location?: { landing_page_url?: string | null; source?: { display_name?: string | null; host_organization_name?: string | null; type?: string | null } | null } | null;
  biblio?: { volume?: string | null; issue?: string | null; first_page?: string | null; last_page?: string | null };
  abstract_inverted_index?: Record<string, number[]> | null; cited_by_count?: number | null;
  open_access?: { is_oa?: boolean; oa_url?: string | null } | null;
};
const text = (value: unknown, max = 1000) => typeof value === "string" ? value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "";

export function openAlexAbstract(index: Work["abstract_inverted_index"]) {
  if (!index || typeof index !== "object") return "";
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) if (Array.isArray(positions)) for (const position of positions) if (Number.isInteger(position) && position >= 0 && position < 5000) words[position] = word;
  return words.filter(Boolean).join(" ").slice(0, 2000);
}

const kinds: Record<string, CitationData["kind"]> = { book: "book", "book-chapter": "book-chapter", dissertation: "thesis", report: "report" };

export function openAlexResult(work: Work, rank: number): DiscoverResult | null {
  const title = text(work.display_name || work.title, 500);
  const doi = doiUrl(work.doi ?? "");
  const url = normalizeUrl(doi || work.primary_location?.landing_page_url || work.id || "");
  if (!title || !url) return null;
  const authors = (work.authorships ?? []).map(entry => text(entry.author?.display_name || entry.raw_author_name, 200)).filter(Boolean);
  const venue = text(work.primary_location?.source?.display_name, 300);
  const pages = [work.biblio?.first_page, work.biblio?.last_page].map(page => text(page, 20)).filter(Boolean);
  const kind = kinds[work.type ?? ""] ?? (work.primary_location?.source?.type === "conference" ? "conference-paper" : "journal-article");
  const date = parseCitationDate(work.publication_date || (work.publication_year ? String(work.publication_year) : ""));
  const citation: CitationData = {
    kind, authors: authors.map(parsePersonName), title, year: date.year,
    containerTitle: kind === "book" || kind === "thesis" || kind === "report" ? undefined : venue || undefined,
    publisher: kind === "book" || kind === "report" ? text(work.primary_location?.source?.host_organization_name, 300) || venue || undefined : undefined,
    volume: text(work.biblio?.volume, 40) || undefined, issue: text(work.biblio?.issue, 40) || undefined,
    pages: pages.length ? pages.join("–") : undefined, doi: doi || undefined, url: doi ? undefined : url,
  };
  return {
    id: `openalex:${text(work.id, 200) || url}`, provider: "openalex", origin: "external", resultType: kind === "book" ? "book" : "paper",
    title, url, summary: openAlexAbstract(work.abstract_inverted_index) || undefined,
    creator: authors.length > 3 ? `${authors[0]} et al.` : authors.join(", ") || undefined,
    sourceName: venue || "OpenAlex", publishedAt: work.publication_date || (work.publication_year ? String(work.publication_year) : undefined),
    relevanceReason: "Scholarly record from OpenAlex.",
    metadata: { provider: "openalex", provider_rank: rank, citation, citedBy: typeof work.cited_by_count === "number" ? work.cited_by_count : undefined,
      openAccessUrl: work.open_access?.is_oa ? normalizeUrl(work.open_access.oa_url ?? "") ?? undefined : undefined },
  };
}

export class OpenAlexProvider implements SearchProvider {
  async search(query: string, filters: DiscoverFilters): Promise<DiscoverResult[]> {
    const endpoint = new URL("https://api.openalex.org/works");
    endpoint.searchParams.set("search", [query, filters.topic].filter(Boolean).join(" "));
    endpoint.searchParams.set("per-page", "25");
    const range = [filters.yearFrom && `from_publication_date:${filters.yearFrom}-01-01`, filters.yearTo && `to_publication_date:${filters.yearTo}-12-31`].filter(Boolean);
    if (range.length) endpoint.searchParams.set("filter", range.join(","));
    if (process.env.OPENALEX_EMAIL) endpoint.searchParams.set("mailto", process.env.OPENALEX_EMAIL);
    const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(response.status === 429 ? "The article index is busy. Please try again shortly." : "The article index could not complete this search. Please try again.");
    const body = await response.json() as { results?: Work[] };
    if (!body || !Array.isArray(body.results)) throw new Error("The article index returned an invalid response.");
    const seen = new Set<string>();
    return body.results.flatMap(work => {
      const result = work && typeof work === "object" ? openAlexResult(work, seen.size + 1) : null;
      if (!result || seen.has(result.url)) return [];
      seen.add(result.url);
      return [result];
    });
  }
}
