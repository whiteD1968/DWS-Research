import type { DiscoverFilters, DiscoverResult, SearchProvider } from "../types";
import type { CitationData } from "../../citation";
import { parseCitationDate, parseCreatorLabel } from "../../citation";
import { imageDimension, safeImageUrl } from "../images";

// Wikimedia Commons media search (https://www.mediawiki.org/wiki/API:Search). No key required.
type Meta = Record<string, { value?: unknown } | undefined>;
type Page = { title?: string; index?: number; imageinfo?: { url?: string; thumburl?: string; width?: number; height?: number; thumbwidth?: number; thumbheight?: number; descriptionurl?: string; mime?: string; extmetadata?: Meta }[] };
const plain = (value: unknown, max = 500) => typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, max) : "";

export function commonsResult(page: Page, rank: number): DiscoverResult | null {
  const info = page.imageinfo?.[0];
  const imageUrl = safeImageUrl(info?.url);
  const pageUrl = safeImageUrl(info?.descriptionurl);
  if (!info || !imageUrl || !pageUrl || !/^image\//.test(info.mime ?? "")) return null;
  const meta = info.extmetadata ?? {};
  const fileTitle = plain(page.title).replace(/^File:/, "").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/_/g, " ");
  const title = plain(meta.ObjectName?.value, 300) || fileTitle || "Untitled image";
  const artist = plain(meta.Artist?.value, 300);
  const unknownArtist = !artist || /^(unknown|anonymous|unknown author)/i.test(artist);
  const date = parseCitationDate(plain(meta.DateTimeOriginal?.value, 100));
  const license = plain(meta.LicenseShortName?.value, 100);
  const citation: CitationData = { kind: "image", authors: unknownArtist ? [] : parseCreatorLabel(artist).slice(0, 5), title, year: date.year,
    description: /^image\/(jpeg|tiff)$/.test(info.mime ?? "") ? "Photograph" : "Image", siteName: "Wikimedia Commons", url: pageUrl };
  return {
    id: `commons:${imageUrl}`, provider: "wikimedia-commons", origin: "external", resultType: "image",
    title, url: imageUrl, imageUrl, sourcePageUrl: pageUrl, thumbnailUrl: safeImageUrl(info.thumburl),
    imageWidth: imageDimension(info.width), imageHeight: imageDimension(info.height),
    creator: unknownArtist ? undefined : artist, publishedAt: date.year, summary: plain(meta.ImageDescription?.value, 600) || undefined,
    sourceName: "Wikimedia Commons", relevanceReason: license ? `Wikimedia Commons · ${license}` : "Wikimedia Commons",
    metadata: { provider: "wikimedia-commons", provider_rank: rank, citation, license: license || undefined },
  };
}

export class WikimediaCommonsProvider implements SearchProvider {
  async search(query: string, filters: DiscoverFilters): Promise<DiscoverResult[]> {
    const endpoint = new URL("https://commons.wikimedia.org/w/api.php");
    for (const [key, value] of Object.entries({ action: "query", format: "json", formatversion: "2", generator: "search", gsrsearch: [query, filters.topic, "filetype:bitmap"].filter(Boolean).join(" "),
      gsrnamespace: "6", gsrlimit: "24", prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "640",
      iiextmetadatafilter: "ObjectName|Artist|DateTimeOriginal|LicenseShortName|ImageDescription" })) endpoint.searchParams.set(key, value);
    const response = await fetch(endpoint, { cache: "no-store", headers: { "User-Agent": "DWS-Research/1.0 (private research workspace)" }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Wikimedia Commons could not complete this search.");
    const body = await response.json() as { query?: { pages?: Page[] } };
    const pages = Array.isArray(body?.query?.pages) ? [...body.query.pages].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)) : [];
    return pages.flatMap((page, index) => { const result = page && typeof page === "object" ? commonsResult(page, index + 1) : null; return result ? [result] : []; });
  }
}
