import type { DiscoverFilters, DiscoverResult, SearchProvider } from "../types";
import type { CitationData } from "../../citation";
import { parsePersonName } from "../../citation";

// Open Library search (https://openlibrary.org/dev/docs/api/search). No key required.
type Doc = { key?: string; title?: string; subtitle?: string; author_name?: string[]; first_publish_year?: number; publisher?: string[];
  isbn?: string[]; cover_i?: number; edition_count?: number; number_of_pages_median?: number; subject?: string[] };
const text = (value: unknown, max = 500) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
const fields = "key,title,subtitle,author_name,first_publish_year,publisher,isbn,cover_i,edition_count,number_of_pages_median,subject";

export function openLibraryResult(doc: Doc, rank: number): DiscoverResult | null {
  const key = text(doc.key, 100);
  const title = [text(doc.title), text(doc.subtitle)].filter(Boolean).join(": ");
  if (!/^\/works\/OL\d+W$/.test(key) || !title) return null;
  const authors = (Array.isArray(doc.author_name) ? doc.author_name : []).map(name => text(name, 200)).filter(Boolean).slice(0, 25);
  const year = Number.isInteger(doc.first_publish_year) ? String(doc.first_publish_year) : undefined;
  const publisher = Array.isArray(doc.publisher) ? text(doc.publisher[0], 300) : "";
  const cover = Number.isInteger(doc.cover_i) && doc.cover_i! > 0 ? doc.cover_i : undefined;
  const citation: CitationData = { kind: "book", authors: authors.map(parsePersonName), title, year, publisher: publisher || undefined };
  const subjects = (Array.isArray(doc.subject) ? doc.subject : []).map(subject => text(subject, 80)).filter(Boolean).slice(0, 6);
  return {
    id: `openlibrary:${key}`, provider: "openlibrary", origin: "external", resultType: "book",
    title, url: `https://openlibrary.org${key}`, creator: authors.slice(0, 3).join(", ") || undefined,
    sourceName: publisher ? `Open Library · ${publisher}` : "Open Library", publishedAt: year,
    summary: [doc.edition_count ? `${doc.edition_count} edition${doc.edition_count === 1 ? "" : "s"}` : "", subjects.length ? `Subjects: ${subjects.join(", ")}` : ""].filter(Boolean).join(". ") || undefined,
    imageUrl: cover ? `https://covers.openlibrary.org/b/id/${cover}-L.jpg` : undefined,
    thumbnailUrl: cover ? `https://covers.openlibrary.org/b/id/${cover}-M.jpg` : undefined,
    relevanceReason: "Book record from Open Library.",
    metadata: { provider: "openlibrary", provider_rank: rank, citation, isbn: Array.isArray(doc.isbn) ? text(doc.isbn[0], 20) || undefined : undefined },
  };
}

export class OpenLibraryProvider implements SearchProvider {
  async search(query: string, filters: DiscoverFilters): Promise<DiscoverResult[]> {
    const endpoint = new URL("https://openlibrary.org/search.json");
    const years = filters.yearFrom || filters.yearTo ? `first_publish_year:[${filters.yearFrom || "*"} TO ${filters.yearTo || "*"}]` : "";
    endpoint.searchParams.set("q", [query, filters.topic, years].filter(Boolean).join(" "));
    endpoint.searchParams.set("fields", fields);
    endpoint.searchParams.set("limit", "24");
    const response = await fetch(endpoint, { cache: "no-store", headers: { "User-Agent": "DWS-Research/1.0 (private research workspace)" }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("The book catalog could not complete this search. Please try again.");
    const body = await response.json() as { docs?: Doc[] };
    if (!body || !Array.isArray(body.docs)) throw new Error("The book catalog returned an invalid response.");
    return body.docs.flatMap((doc, index) => { const result = doc && typeof doc === "object" ? openLibraryResult(doc, index + 1) : null; return result ? [result] : []; });
  }
}
