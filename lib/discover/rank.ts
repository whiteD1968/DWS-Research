import type { DiscoverMode, DiscoverResult } from "./types";

const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_]/g, " ");
const architecture = /\b(architectur\w*|pavilion|installation|facade|structure|building|shell|vault|masonry|stereotom\w*)\b/g;
const fabrication = /\b(robot\w*|extrusion|additive manufacturing|3d print\w*|binder jetting|milling|toolpath|fabricat\w*)\b/g;
const materials = /\b(concrete|clay|stone|marble|limestone|mineral|bio based|recycled|polymer|pellet|plastic)\b/g;
const project = /\b(project|pavilion|installation|prototype|case study|built work|demonstrator)\b/;
const publications = ["archdaily.com", "dezeen.com", "designboom.com", "divisare.com"];
const journals = ["doi.org", "arxiv.org", "sciencedirect.com", "link.springer.com", "onlinelibrary.wiley.com", "tandfonline.com", "nature.com", "dl.acm.org", "ieeexplore.ieee.org"];
const offices = ["fosterandpartners.com", "zaha-hadid.com", "big.dk", "snohetta.com", "mvrdv.com"];
const onDomain = (host: string, domains: string[]) => domains.some(domain => host === domain || host.endsWith(`.${domain}`));
const hits = (text: string, expression: RegExp) => [...new Set(text.match(expression) ?? [])];

export function discoverMode(value: string): DiscoverMode {
  if (value === "studio") return "lab";
  return ["project", "paper", "lab", "video", "image"].includes(value) ? value as DiscoverMode : "all";
}

export function classifyDiscoverResult(result: DiscoverResult) {
  const url = new URL(result.sourcePageUrl || result.url);
  const host = url.hostname.toLowerCase();
  const path = normalize(url.pathname);
  const title = normalize(result.title);
  const text = `${title} ${normalize(result.summary ?? "")}`;
  const university = /\.(edu|ac\.[a-z]{2})(\.|$)/.test(host) || onDomain(host, ["ethz.ch", "epfl.ch", "tudelft.nl", "tum.de", "uni-stuttgart.de"]);
  const journal = onDomain(host, journals);
  const office = onDomain(host, offices);
  const projectPage = /\/(projects?|case studies|work|portfolio)\//.test(path);
  let classification: DiscoverResult["resultType"] = "other";
  const evidence: string[] = [];
  function classify(type: DiscoverResult["resultType"], reason: string) { classification = type; evidence.push(reason); }

  if (result.resultType === "image") classify("image", "Image search result");
  else if (onDomain(host, ["youtube.com", "youtu.be", "vimeo.com"]) || /\/(video|watch|videos)(\/|$)/.test(path) || result.resultType === "video") classify("video", "Video source or page");
  else if (/\/(products?|shop|store|catalog)(\/|$)/.test(path) || /\b(buy now|add to cart|request a quote|for sale)\b/.test(text)) classify("product", "Product or sales page");
  else if (journal || /\b(doi|proceedings|journal|thesis|dissertation|research paper|conference paper)\b/.test(text) || (/\.pdf$/.test(path) && /\b(abstract|authors?|research|conference|study)\b/.test(text))) classify("paper", "Scholarly source or publication language");
  else if (projectPage || project.test(title) || (project.test(text) && /\b(fabricated|constructed|built|3d printed|completed)\b/.test(text))) classify("project", "Project page or case-study language");
  else if (/\b(laboratory|research group|research lab|fabrication lab|institute|research cent(er|re))\b/.test(text) || /\/(labs?|research groups?)(\/|$)/.test(path)) classify("lab", "Lab or research-group identity");
  else if (/\b(supplier|manufacturer|equipment catalog|machine sales)\b/.test(text)) classify("vendor", "Commercial supplier language");
  else if (/\.(jpg|jpeg|png|webp)$/.test(path)) classify("image", "Image resource");
  else if (result.summary || result.resultType === "article") classify("article", "General editorial page");

  const classified = classification as DiscoverResult["resultType"];
  const sourceType = classified === "video" ? "Video" : ["vendor", "product"].includes(classified) ? "Vendor" :
    journal ? "Journal" : /\b(proceedings|conference paper)\b/.test(text) ? "Conference" : university ? "University" :
    office ? "Architecture office" : projectPage ? "Project page" : classified === "lab" ? "Lab" :
    onDomain(host, publications) ? "Publication" : "Web source";
  return { classification: classified, evidence, sourceType, projectPage, university, journal, office, publication: onDomain(host, publications) };
}

const modeOrder: Record<DiscoverMode, string[]> = {
  all: [], project: ["project", "lab", "paper", "article", "video", "image", "other", "vendor", "product"],
  paper: ["paper", "lab", "article", "project", "video", "image", "other", "vendor", "product"],
  lab: ["lab", "project", "paper", "article", "video", "image", "other", "vendor", "product"],
  video: ["video", "project", "lab", "paper", "article", "image", "other", "vendor", "product"],
  image: ["image", "project", "article", "paper", "lab", "video", "other", "vendor", "product"],
};

export function rankDiscoverResults(results: DiscoverResult[], query: string, mode: DiscoverMode = "all"): DiscoverResult[] {
  const stop = new Set("find using with from that this about related through into the and for are how what architecture architectural".split(" "));
  const terms = [...new Set(normalize(query).match(/[a-z0-9]+/g) ?? [])].filter(word => word.length > 2 && !stop.has(word));
  return results.map((result, index) => {
    const classification = classifyDiscoverResult(result);
    const title = normalize(result.title);
    const snippet = normalize(result.summary ?? "");
    const text = `${title} ${snippet}`;
    const titleWords = new Set(title.match(/[a-z0-9]+/g));
    const snippetWords = new Set(snippet.match(/[a-z0-9]+/g));
    const titleHits = terms.filter(word => titleWords.has(word));
    const snippetHits = terms.filter(word => snippetWords.has(word));
    const a = hits(text, architecture), f = hits(text, fabrication), m = hits(text, materials);
    const penalties: string[] = [];
    if (["vendor", "product"].includes(classification.classification)) penalties.push("Commercial product or supplier");
    if (/\b(best|top \d+|buying guide|ultimate guide)\b/.test(title)) penalties.push("Generic guide language");
    if (/\b(desktop|hobby|miniatures|benchy|gaming|cosplay)\b/.test(text)) penalties.push("Consumer printing focus");
    if (!titleHits.length && snippetHits.length < 2) penalties.push("Weak query match");
    const order = modeOrder[mode];
    const position = order.indexOf(classification.classification);
    const modeBoost = mode === "all" ? 0 : Math.max(0, 120 - Math.max(0, position) * 30);
    const scoreBreakdown = {
      query: Math.round(30 * titleHits.length / Math.max(1, terms.length) + 15 * snippetHits.length / Math.max(1, terms.length)),
      architecture: Math.min(12, a.length * 4), fabrication: Math.min(15, f.length * 5), material: Math.min(10, m.length * 4),
      projectLikelihood: classification.classification === "project" ? 12 : 0,
      sourceQuality: classification.journal || classification.university ? 8 : classification.office || classification.publication ? 6 : classification.projectPage ? 4 : 0,
      mode: modeBoost, penalty: -penalties.length * 12,
    };
    const relevanceScore = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0);
    const signals = [...f.slice(0, 1), ...m.slice(0, 1), ...a.slice(0, 1)];
    const relevanceReason = signals.length ? `${classification.classification === "paper" ? "Academic match" : "Related"}: ${signals.join(" + ")}` :
      titleHits.length ? `Query match: ${titleHits.slice(0, 3).join(" + ")}` : "Limited direct match to the question";
    return { ...result, resultType: classification.classification, relevanceReason,
      metadata: { ...result.metadata, classification: classification.classification, classificationEvidence: classification.evidence,
        sourceType: classification.sourceType, relevanceScore, scoreBreakdown, penalties, rankingVersion: 1, rankingMode: mode,
        originalRank: typeof result.metadata?.provider_rank === "number" ? result.metadata.provider_rank : index + 1 } };
  }).sort((a, b) => b.metadata.relevanceScore - a.metadata.relevanceScore || a.metadata.originalRank - b.metadata.originalRank);
}
