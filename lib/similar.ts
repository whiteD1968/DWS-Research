// Finding images that resemble others, from their tags and descriptions. Pure, so it stays testable.

export type ImageFeatures = { id: string; tags: string[]; text: string };
export type SimilarMatch = { id: string; score: number; shared: string[] };

const stopwords = new Set("a an and are as at be by for from has have in into is it its of on or over that the their this to under with without while within near beside showing shows shown view image photo picture photograph close up one two three several some small large white black grey gray".split(" "));

// Caption words worth comparing: lowercase, no stopwords, simple plurals folded.
export function captionWords(text: string) {
  return [...new Set((text.toLowerCase().match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu) || [])
    .filter(word => word.length > 2 && !stopwords.has(word) && !/^\d+$/.test(word))
    .map(word => (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word)))];
}

// Tags count double a caption word; both are weighted so a tag or word on most images counts for little.
function vectors(images: ImageFeatures[]) {
  const featuresOf = (image: ImageFeatures) => [...new Set(image.tags.map(tag => `#${tag.toLowerCase()}`)), ...captionWords(image.text)];
  const lists = new Map(images.map(image => [image.id, featuresOf(image)]));
  const seen = new Map<string, number>();
  lists.forEach(list => list.forEach(feature => seen.set(feature, (seen.get(feature) || 0) + 1)));
  const weight = (feature: string) => Math.log(1 + images.length / (seen.get(feature) || 1)) * (feature.startsWith("#") ? 2 : 1);
  return new Map([...lists].map(([id, list]) => [id, new Map(list.map(feature => [feature, weight(feature)]))]));
}

const norm = (vector: Map<string, number>) => Math.sqrt([...vector.values()].reduce((sum, value) => sum + value * value, 0));

// Images most like the given ones, best first, leaving out the given ones. Each match names the tags it shares.
export function similarImages(targetIds: string[], images: ImageFeatures[], limit = 8, minimum = 0.08): SimilarMatch[] {
  const index = vectors(images);
  const targets = new Set(targetIds);
  const combined = new Map<string, number>();
  targetIds.forEach(id => index.get(id)?.forEach((value, feature) => combined.set(feature, (combined.get(feature) || 0) + value)));
  const size = norm(combined);
  if (!size) return [];
  const matches: SimilarMatch[] = [];
  for (const [id, vector] of index) {
    if (targets.has(id)) continue;
    let dot = 0; const shared: [string, number][] = [];
    vector.forEach((value, feature) => {
      const other = combined.get(feature);
      if (!other) return;
      dot += value * other;
      if (feature.startsWith("#")) shared.push([feature.slice(1), value]);
    });
    const score = dot / (size * (norm(vector) || 1));
    if (score >= minimum) matches.push({ id, score, shared: shared.sort((a, b) => b[1] - a[1]).map(([tag]) => tag).slice(0, 3) });
  }
  return matches.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
}
