// Web links are notes with parent_type "weblink": the page title is the note title, your own notes are the plain text,
// and the address, tags, and page details live in metadata, so no migration is needed.
export const weblinkParent = "weblink";
export const weblinkProjectType = "weblink_project";
export const maxImport = 300;
export const maxTags = 12;

export type Weblink = {
  id: string; url: string; title: string; notes: string; domain: string; description: string; siteName: string; image: string;
  tags: string[]; frame: FrameStatus; savedAt: string; batch: string; openedAt: string;
};
export type FrameStatus = "ok" | "blocked" | "unknown";
export type LinkDraft = { url: string; title: string };

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

// Tracking parameters say nothing about the page, so they are dropped before saving and before comparing for duplicates.
const tracking = /^(utm_[a-z]+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid|igsh|si|ref_src|ref_url|_hsenc|_hsmi|mkt_tok|spm|vero_id|oly_anon_id|oly_enc_id|yclid|s_cid)$/i;
export function cleanUrl(value: string): string | null {
  const text = value.trim().replace(/[)\].,;:'">]+$/, "");
  if (!text) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : /^(www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(text) ? `https://${text}` : "";
  if (!withScheme) return null;
  let url: URL;
  try { url = new URL(withScheme); } catch { return null; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
  if (url.username || url.password) { url.username = ""; url.password = ""; }
  for (const key of [...url.searchParams.keys()]) if (tracking.test(key)) url.searchParams.delete(key);
  return url.toString();
}

// Two addresses that differ only by "www.", a trailing slash, the scheme, or a #section are the same page.
export function linkKey(value: string) {
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const search = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&");
    return `${url.hostname.replace(/^www\./, "").toLowerCase()}${path}${search ? `?${search}` : ""}`;
  } catch { return value.trim().toLowerCase(); }
}

export function domainOf(value: string) {
  try { return new URL(value).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

const decodeEntities = (text: string) => text.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp|#39);/gi, (match, code: string) => {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
  const lower = code.toLowerCase();
  if (named[lower]) return named[lower];
  const n = lower.startsWith("#x") ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
  return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
});
const urlPattern = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;

// Reads links out of whatever was pasted or dropped in: plain lists of addresses, "Title - address" lines,
// Markdown links, a Chrome or Safari bookmarks export (HTML), or a tab list from an extension like OneTab ("address | Title").
export function parseLinkList(input: string): LinkDraft[] {
  const text = typeof input === "string" ? input.slice(0, 2_000_000) : "";
  const found: LinkDraft[] = [];
  const add = (rawUrl: string, rawTitle = "") => {
    const url = cleanUrl(decodeEntities(rawUrl));
    if (url) found.push({ url, title: decodeEntities(rawTitle.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim().slice(0, 300) });
  };
  if (/<a\s[^>]*href=/i.test(text)) {
    for (const match of text.matchAll(/<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) add(match[1]!, match[2]!);
  } else {
    const lines = text.split(/\r?\n/);
    let previous = "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { previous = ""; continue; }
      const markdown = [...line.matchAll(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi)];
      if (markdown.length) { for (const match of markdown) add(match[2]!, match[1]!); previous = ""; continue; }
      const urls = line.match(urlPattern) || [];
      if (!urls.length) { previous = line; continue; }
      if (urls.length === 1) {
        const rest = line.replace(urls[0]!, "").replace(/^[\s|•·:–—-]+|[\s|•·:–—-]+$/g, "").replace(/\s*\|\s*$/, "").trim();
        add(urls[0]!, rest || (previous && !(previous.match(urlPattern) || []).length ? previous : ""));
      } else for (const url of urls) add(url);
      previous = "";
    }
  }
  return dedupeDrafts(found).slice(0, maxImport);
}

export function dedupeDrafts(drafts: LinkDraft[]) {
  const seen = new Map<string, LinkDraft>();
  for (const draft of drafts) {
    const key = linkKey(draft.url);
    const existing = seen.get(key);
    if (!existing) seen.set(key, { ...draft });
    else if (!existing.title && draft.title) existing.title = draft.title;
  }
  return [...seen.values()];
}

// The browser extension and the bookmarklet hand tabs over in the page address after "#import=", as base64url JSON.
export function encodeImport(drafts: { u: string; t?: string }[]) {
  const bytes = new TextEncoder().encode(JSON.stringify(drafts));
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decodeImport(value: string): LinkDraft[] {
  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    const json = new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
    const list = JSON.parse(json);
    if (!Array.isArray(list)) return [];
    return dedupeDrafts(list.flatMap(item => {
      const url = item && typeof item === "object" ? cleanUrl(str(item.u)) : null;
      return url ? [{ url, title: str(item.t).replace(/\s+/g, " ").slice(0, 300) }] : [];
    })).slice(0, maxImport);
  } catch { return []; }
}

export function parseTags(values: unknown): string[] {
  const list = Array.isArray(values) ? values : typeof values === "string" ? values.split(",") : [];
  const out: string[] = [];
  for (const value of list) {
    const tag = str(value).replace(/\s+/g, " ").replace(/^#/, "").slice(0, 40);
    if (tag && !out.some(existing => existing.toLowerCase() === tag.toLowerCase())) out.push(tag);
  }
  return out.slice(0, maxTags);
}

export function weblinkFrom(row: { id?: unknown; title?: unknown; plain_text?: unknown; metadata?: unknown; created_at?: unknown }): Weblink | null {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const url = str(meta.url);
  if (!url) return null;
  const domain = str(meta.domain) || domainOf(url);
  const frame = meta.frame === "ok" || meta.frame === "blocked" ? meta.frame : "unknown";
  return {
    id: str(row.id), url, title: str(row.title) || domain || url, notes: str(row.plain_text), domain,
    description: str(meta.description), siteName: str(meta.site_name), image: /^https:\/\//.test(str(meta.image)) ? str(meta.image) : "",
    tags: parseTags(meta.tags), frame, savedAt: str(meta.saved_at) || str(row.created_at), batch: str(meta.batch), openedAt: str(meta.opened_at),
  };
}

export function matchesLink(link: Weblink, query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [link.title, link.url, link.domain, link.description, link.notes, link.siteName, ...link.tags].join(" ").toLowerCase();
  return words.every(word => hay.includes(word));
}

export function tagCounts(links: Weblink[]) {
  const counts = new Map<string, number>();
  for (const link of links) for (const tag of link.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }));
}

// ---------- Automatic tags ----------
// Sites are matched by domain first; words in the title and description add topic tags on top.
// The list leans toward an art, architecture, and fabrication practice with a teaching job.
const siteRules: [string, RegExp][] = [
  ["Video", /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|twitch\.tv|ted\.com|dailymotion\.com|loom\.com)$/],
  ["Social", /(^|\.)(instagram\.com|facebook\.com|x\.com|twitter\.com|threads\.net|threads\.com|linkedin\.com|tiktok\.com|reddit\.com|bsky\.app|mastodon\.social|tumblr\.com)$/],
  ["Inspiration", /(^|\.)(pinterest\.[a-z.]+|pin\.it|behance\.net|dribbble\.com|are\.na|flickr\.com|unsplash\.com|savee\.it|cosmos\.so|cargo\.site|cargocollective\.com)$/],
  ["Architecture", /(^|\.)(archdaily\.com|archdaily\.[a-z.]+|dezeen\.com|designboom\.com|architizer\.com|archinect\.com|architecturalrecord\.com|divisare\.com|archpaper\.com|aia\.org|acsa-arch\.org|metropolismag\.com|architectmagazine\.com|domusweb\.it|architectural-review\.com|world-architects\.com|e-architect\.com|arquitecturaviva\.com|landezine\.com|plataformaarquitectura\.cl)$/],
  ["Art", /(^|\.)(artforum\.com|hyperallergic\.com|artsy\.net|artnet\.com|e-flux\.com|frieze\.com|artnews\.com|theartnewspaper\.com|moma\.org|guggenheim\.org|tate\.org\.uk|metmuseum\.org|whitney\.org|artic\.edu|sfmoma\.org|lacma\.org|brooklynrail\.org|artsandculture\.google\.com|wikiart\.org|colossal\.com|thisiscolossal\.com|juxtapoz\.com|ceramicartsnetwork\.org|nceca\.net)$/],
  ["Design", /(^|\.)(core77\.com|itsnicethat\.com|design-milk\.com|wallpaper\.com|dwell\.com|yankodesign\.com|designweek\.co\.uk|fastcompany\.com|eyeondesign\.aiga\.org|aiga\.org|dieline\.com|surfacemag\.com|azuremagazine\.com|ignant\.com|leibal\.com)$/],
  ["Fabrication", /(^|\.)(instructables\.com|thingiverse\.com|printables\.com|prusa3d\.com|formlabs\.com|ultimaker\.com|bambulab\.com|makerworld\.com|myminifactory\.com|cults3d\.com|shopbottools\.com|hackaday\.com|hackster\.io|adafruit\.com|sparkfun\.com|arduino\.cc|makezine\.com|grabcad\.com|xometry\.com|sendcutsend\.com|protolabs\.com|epiloglaser\.com|glowforge\.com|universal-robots\.com|kuka\.com)$/],
  ["Shopping", /(^|\.)(amazon\.[a-z.]+|a\.co|amzn\.to|ebay\.com|etsy\.com|homedepot\.com|lowes\.com|dickblick\.com|uline\.com|mcmaster\.com|grainger\.com|walmart\.com|target\.com|bhphotovideo\.com|aliexpress\.com|wayfair\.com|ikea\.com|rockler\.com|woodcraft\.com|blick\.com|bigceramicstore\.com|sheffield-pottery\.com)$/],
  ["Research", /(^|\.)(scholar\.google\.com|jstor\.org|researchgate\.net|academia\.edu|arxiv\.org|doi\.org|sciencedirect\.com|springer\.com|link\.springer\.com|tandfonline\.com|wiley\.com|onlinelibrary\.wiley\.com|sagepub\.com|muse\.jhu\.edu|openalex\.org|semanticscholar\.org|ncbi\.nlm\.nih\.gov|pubmed\.ncbi\.nlm\.nih\.gov|nature\.com|science\.org|mitpressjournals\.org|direct\.mit\.edu|cambridge\.org|oup\.com|academic\.oup\.com|ieeexplore\.ieee\.org|dl\.acm\.org|cumincad\.architexturez\.net|ssrn\.com|papers\.ssrn\.com|proquest\.com|ebscohost\.com|worldcat\.org|zotero\.org)$/],
  ["Books", /(^|\.)(goodreads\.com|openlibrary\.org|books\.google\.com|bookshop\.org|archive\.org|gutenberg\.org|press\.princeton\.edu|mitpress\.mit\.edu|routledge\.com|birkhauser\.com|phaidon\.com|papress\.com|actar\.com|lars-mueller-publishers\.com|uchicago\.edu)$/],
  ["Opportunities", /(^|\.)(callforentry\.org|artworkarchive\.com|nyfa\.org|transartists\.org|codaworx\.com|publicartarchive\.org|americansforthearts\.org|artdeadline\.com|artistcommunities\.org|resartis\.org|creative-capital\.org|grants\.gov|neh\.gov|arts\.gov|submittable\.com|zapplication\.org|entrythingy\.com|artcall\.org|cafe\.org|artopportunitiesmonthly\.com|curatorspace\.com)$/],
  ["Teaching", /(^|\.)(instructure\.com|canvas\.[a-z0-9-]+\.edu|blackboard\.com|brightspace\.com|d2l\.com|moodle\.org|gradescope\.com|kahoot\.it|edpuzzle\.com|perusall\.com|padlet\.com|classroom\.google\.com)$/],
  ["Tools", /(^|\.)(github\.com|gitlab\.com|rhino3d\.com|food4rhino\.com|grasshopper3d\.com|mcneel\.com|autodesk\.com|adobe\.com|figma\.com|miro\.com|notion\.so|blender\.org|sketchup\.com|unrealengine\.com|unity\.com|processing\.org|p5js\.org|openprocessing\.org|kangaroo3d\.com|stackoverflow\.com|vercel\.com|supabase\.com|cad\.onshape\.com|onshape\.com|fusion360\.autodesk\.com)$/],
  ["AI", /(^|\.)(openai\.com|chatgpt\.com|anthropic\.com|claude\.ai|midjourney\.com|huggingface\.co|perplexity\.ai|gemini\.google\.com|runwayml\.com|stability\.ai|krea\.ai|replicate\.com)$/],
  ["Docs", /(^|\.)(docs\.google\.com|drive\.google\.com|dropbox\.com|onedrive\.live\.com|sharepoint\.com|box\.com|icloud\.com|1drv\.ms|paper\.dropbox\.com|wetransfer\.com)$/],
  ["News", /(^|\.)(nytimes\.com|theguardian\.com|washingtonpost\.com|bbc\.co\.uk|bbc\.com|npr\.org|cnn\.com|apnews\.com|reuters\.com|theatlantic\.com|newyorker\.com|wired\.com|bloomberg\.com|wsj\.com|latimes\.com|vox\.com|axios\.com|tampabay\.com|miamiherald\.com|orlandosentinel\.com|news\.google\.com)$/],
  ["Maps & places", /(^|\.)(maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.apple\.com|openstreetmap\.org|atlasobscura\.com|google\.com\/maps|earth\.google\.com|tripadvisor\.com|airbnb\.com|booking\.com)$/],
  ["Email", /(^|\.)(mail\.google\.com|outlook\.live\.com|outlook\.office\.com|outlook\.office365\.com|mail\.yahoo\.com)$/],
];

const wordRules: [string, RegExp][] = [
  ["Opportunities", /\b(call for (artists|entries|proposals|submissions|papers)|open call|residenc(y|ies)|fellowships?|grants?|rf[qp]s?|request for (qualifications|proposals)|commissions?|competitions?|juried|award deadline|submissions? (open|due)|percent for art)\b/i],
  ["Public art", /\b(public art|placemaking|monument|mural|sculpture park|art in public places)\b/i],
  ["Architecture", /\b(architect(ure|ural|s)?|pavilion|fa[cç]ade|building design|adaptive reuse|urbanism|urban design|landscape architecture|housing project)\b/i],
  ["Installation", /\b(installations?|site[- ]specific|immersive|environment(al)? art)\b/i],
  ["Fabrication", /\b(fabricat(ion|ed|ing)|3d[- ]?print(ing|ed|er)?|additive manufacturing|cnc|laser[- ]?cut(ting|ter)?|robotic (arm|fabrication)|milling|router|welding|casting|thermoform(ing)?|digital fabrication|design[- ]build)\b/i],
  ["Ceramics", /\b(ceramics?|clay|glaze[sd]?|kiln|porcelain|stoneware|earthenware|pottery|slip ?cast(ing)?)\b/i],
  ["Materials", /\b(materials? (research|library|science)|timber|plywood|concrete|steel|aluminum|bioplastic|mycelium|composite|terracotta|textiles?)\b/i],
  ["Furniture", /\b(furniture|chairs?|stools?|benches|lighting design|lamps?)\b/i],
  ["Computational", /\b(parametric|grasshopper|computational design|generative|algorithm(ic)?|scripting|python|rhino(ceros)?|creative coding)\b/i],
  ["Tutorials", /\b(how to|tutorials?|step[- ]by[- ]step|beginner'?s guide|walkthrough|workshop video|demo)\b/i],
  ["Teaching", /\b(syllabus|syllabi|pedagogy|course (design|outline)|lesson plans?|studio course|curriculum|rubric|students?|teaching)\b/i],
  ["Tenure", /\b(tenure|promotion and tenure|p&t|dossier|faculty review|annual review)\b/i],
  ["Exhibitions", /\b(exhibitions?|exhibit|biennale?|triennial|gallery show|on view|retrospective)\b/i],
  ["Research", /\b(journal article|peer[- ]reviewed|proceedings|abstract|literature review|doi:|dissertation|thesis)\b/i],
  ["Books", /\b(isbn|hardcover|paperback|book review|new book)\b/i],
  ["Jobs", /\b(job (posting|opening)|faculty position|assistant professor|associate professor|hiring|careers?|vacanc(y|ies)|search committee)\b/i],
  ["Events", /\b(conference|symposium|lecture series|webinar|talk|panel discussion|register now|rsvp|tickets?)\b/i],
];

export function autoTags(url: string, title = "", description = ""): string[] {
  const tags: string[] = [];
  const add = (tag: string) => { if (!tags.includes(tag)) tags.push(tag); };
  let host = ""; let path = "";
  try { const parsed = new URL(url); host = parsed.hostname.replace(/^www\./, "").toLowerCase(); path = parsed.pathname.toLowerCase(); } catch { /* not a URL */ }
  const hostAndPath = `${host}${path}`;
  for (const [tag, rule] of siteRules) if (rule.test(host) || (tag === "Maps & places" && /^(google\.[a-z.]+\/maps|goo\.gl\/maps)/.test(hostAndPath))) add(tag);
  if (/\.pdf$/.test(path)) add("PDF");
  if (/\.edu$/.test(host) && !tags.length) add("University");
  // Amazon book pages are books more than shopping.
  if (tags.includes("Shopping") && /\b(book|paperback|hardcover|kindle)\b/i.test(title)) add("Books");
  const text = `${title} ${description}`;
  for (const [tag, rule] of wordRules) if (rule.test(text)) add(tag);
  return tags.slice(0, 6);
}

export function mergeTags(...lists: string[][]) { return parseTags(lists.flat()); }

// ---------- Opening links inside the site ----------
// Some players and documents have an address made for embedding, which works even when the main page refuses to be framed.
export function embedUrl(value: string): string | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  const host = url.hostname.replace(/^(www|m)\./, "");
  if (host === "youtube.com" && url.pathname === "/watch" && url.searchParams.get("v")) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(url.searchParams.get("v")!)}`;
  if (host === "youtube.com" && /^\/shorts\/[\w-]+/.test(url.pathname)) return `https://www.youtube-nocookie.com/embed/${url.pathname.split("/")[2]}`;
  if (host === "youtu.be" && /^\/[\w-]+$/.test(url.pathname)) return `https://www.youtube-nocookie.com/embed${url.pathname}`;
  if (host === "vimeo.com" && /^\/\d+/.test(url.pathname)) return `https://player.vimeo.com/video/${url.pathname.split("/")[1]}`;
  if (host === "docs.google.com" && /^\/(document|spreadsheets|presentation)\/d\/[\w-]+/.test(url.pathname)) return `https://docs.google.com${url.pathname.replace(/\/(edit|view|preview)?$/, "").replace(/\/$/, "")}/preview`;
  if (host === "drive.google.com" && /^\/file\/d\/[\w-]+/.test(url.pathname)) return `https://drive.google.com${url.pathname.replace(/\/(view|edit|preview)?$/, "").replace(/\/$/, "")}/preview`;
  return null;
}

// A page that sends X-Frame-Options or a CSP frame-ancestors rule can't be shown inside another site; the browser blanks it.
export function frameStatusFromHeaders(headers: { get(name: string): string | null }, ownOrigin = ""): FrameStatus {
  const xfo = (headers.get("x-frame-options") || "").toLowerCase();
  if (/\b(deny|sameorigin)\b/.test(xfo) || /allow-from/.test(xfo)) return "blocked";
  const csp = (headers.get("content-security-policy") || "").toLowerCase();
  const rule = csp.split(";").map(part => part.trim()).find(part => part.startsWith("frame-ancestors"));
  if (rule) {
    const sources = rule.split(/\s+/).slice(1);
    if (sources.includes("*")) return "ok";
    const own = ownOrigin.toLowerCase();
    if (own && sources.some(source => source === own || (source.startsWith("https://*.") && own.endsWith(source.slice(9))))) return "ok";
    return "blocked";
  }
  return "ok";
}

export function batchLabel(date = new Date()) {
  return `Tabs · ${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date)}`;
}

export const faviconUrl = (domain: string) => (domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : "");

// ---------- Page details ----------
export type PageInfo = { title: string; description: string; siteName: string; image: string; frame: FrameStatus };
const metaContent = (html: string, names: string[]) => {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const a = html.match(new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*content\\s*=\\s*["']([^"']*)["']`, "i"));
    const b = html.match(new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name)\\s*=\\s*["']${escaped}["']`, "i"));
    const value = (a?.[1] ?? b?.[1] ?? "").trim();
    if (value) return decodeEntities(value).replace(/\s+/g, " ").trim();
  }
  return "";
};
export function pageInfoFromHtml(html: string, pageUrl: string): Omit<PageInfo, "frame"> {
  const head = html.slice(0, 300_000);
  const title = metaContent(head, ["og:title", "twitter:title"]) || decodeEntities((head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim());
  const description = metaContent(head, ["og:description", "description", "twitter:description"]);
  const siteName = metaContent(head, ["og:site_name", "application-name"]);
  let image = metaContent(head, ["og:image", "og:image:url", "twitter:image"]);
  try { image = image ? new URL(image, pageUrl).toString() : ""; } catch { image = ""; }
  return { title: title.slice(0, 300), description: description.slice(0, 600), siteName: siteName.slice(0, 120), image: image.startsWith("https://") ? image.slice(0, 1000) : "" };
}

// Server-side page fetches must stay on the public internet.
export function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (host.includes(":")) return host === "::1" || host === "::" || /^(fc|fd|fe8|fe9|fea|feb)/.test(host) || host.startsWith("::ffff:");
  return false;
}
