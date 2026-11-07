import type { DiscoverFilters, DiscoverResult, SearchProvider } from "../types";
import type { CitationData } from "../../citation";
import { parseCitationDate, parsePersonName } from "../../citation";
import { imageDimension } from "../images";

// Art Institute of Chicago public API (https://api.artic.edu/docs). No key required.
type Artwork = { id?: number; title?: string; artist_title?: string | null; artist_display?: string | null; date_display?: string | null; date_end?: number | null;
  image_id?: string | null; medium_display?: string | null; artwork_type_title?: string | null; is_public_domain?: boolean; thumbnail?: { width?: number; height?: number; alt_text?: string } | null };
const text = (value: unknown, max = 500) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
const fields = "id,title,artist_title,artist_display,date_display,date_end,image_id,medium_display,artwork_type_title,is_public_domain,thumbnail";

export function articResult(artwork: Artwork, rank: number, iiif = "https://www.artic.edu/iiif/2"): DiscoverResult | null {
  const id = Number.isInteger(artwork.id) ? artwork.id : undefined;
  const imageId = text(artwork.image_id, 100);
  const title = text(artwork.title) || "Untitled";
  if (!id || !/^[a-f0-9-]{8,64}$/i.test(imageId) || !/^https:\/\/[a-z0-9.-]+\/iiif\/2$/.test(iiif)) return null;
  const artist = text(artwork.artist_title, 200);
  const date = text(artwork.date_display, 100);
  const pageUrl = `https://www.artic.edu/artworks/${id}`;
  const type = text(artwork.artwork_type_title, 60);
  const citation: CitationData = { kind: "artwork", authors: artist && !/^unknown/i.test(artist) ? [parsePersonName(artist)] : [], title,
    year: parseCitationDate(date).year, description: type || "Artwork", siteName: "Art Institute of Chicago", place: "Chicago, IL, United States", url: pageUrl };
  return {
    id: `artic:${id}`, provider: "artic", origin: "external", resultType: "image", title,
    url: `${iiif}/${imageId}/full/843,/0/default.jpg`, imageUrl: `${iiif}/${imageId}/full/843,/0/default.jpg`, thumbnailUrl: `${iiif}/${imageId}/full/400,/0/default.jpg`,
    sourcePageUrl: pageUrl, imageWidth: imageDimension(artwork.thumbnail?.width), imageHeight: imageDimension(artwork.thumbnail?.height),
    creator: text(artwork.artist_display, 300) || artist || undefined, publishedAt: date || undefined,
    summary: [text(artwork.medium_display, 300), text(artwork.thumbnail?.alt_text, 600)].filter(Boolean).join(". ") || undefined,
    sourceName: "Art Institute of Chicago", relevanceReason: artwork.is_public_domain ? "Art Institute of Chicago · public domain" : "Art Institute of Chicago",
    metadata: { provider: "artic", provider_rank: rank, citation, license: artwork.is_public_domain ? "Public domain" : undefined },
  };
}

export class ArticProvider implements SearchProvider {
  async search(query: string, filters: DiscoverFilters): Promise<DiscoverResult[]> {
    const endpoint = new URL("https://api.artic.edu/api/v1/artworks/search");
    endpoint.searchParams.set("q", [query, filters.topic].filter(Boolean).join(" "));
    endpoint.searchParams.set("limit", "20");
    endpoint.searchParams.set("fields", fields);
    const response = await fetch(endpoint, { cache: "no-store", headers: { "AIC-User-Agent": "DWS-Research (private research workspace)" }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("The Art Institute of Chicago collection could not complete this search.");
    const body = await response.json() as { data?: Artwork[]; config?: { iiif_url?: string } };
    if (!body || !Array.isArray(body.data)) throw new Error("The Art Institute of Chicago returned an invalid response.");
    return body.data.flatMap((artwork, index) => { const result = artwork && typeof artwork === "object" ? articResult(artwork, index + 1, body.config?.iiif_url) : null; return result ? [result] : []; });
  }
}
