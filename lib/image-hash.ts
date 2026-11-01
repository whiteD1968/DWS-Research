// Matching near-identical images by a small fingerprint of their light and dark areas. Pure, so it stays testable.

export const hashSize = { width: 9, height: 8 } as const;

// A difference hash: each bit says whether a pixel is brighter than its right-hand neighbour, on a 9×8 greyscale copy.
// Resizing, re-saving and small colour changes leave it nearly the same; different pictures differ in many bits.
export function differenceHash(pixels: ArrayLike<number>) {
  if (pixels.length < hashSize.width * hashSize.height) throw new Error("Not enough pixels for a fingerprint.");
  let bits = "";
  for (let y = 0; y < hashSize.height; y += 1)
    for (let x = 0; x < hashSize.width - 1; x += 1)
      bits += pixels[y * hashSize.width + x] > pixels[y * hashSize.width + x + 1] ? "1" : "0";
  return bits.match(/.{4}/g)!.map(nibble => parseInt(nibble, 2).toString(16)).join("");
}

const bitsIn = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
// How many of the 64 bits differ between two fingerprints.
export function hashDistance(a: string, b: string) {
  if (a.length !== b.length) return 64;
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) distance += bitsIn[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  return distance;
}

export const isHash = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{16}$/.test(value);
// Fingerprints with almost no contrast (blank or single-colour images) match everything, so they are left out.
const informative = (hash: string) => hash !== "0000000000000000" && hash !== "ffffffffffffffff";
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

// Groups of images whose fingerprints are within maxDistance of 64 bits (8 tolerates resizing and re-saving), leaving out pairs marked as not duplicates.
export function duplicateGroups(hashes: Record<string, string>, maxDistance = 8, distinct: Iterable<string> = []) {
  const skip = new Set(distinct);
  const ids = Object.keys(hashes).filter(id => isHash(hashes[id]) && informative(hashes[id])).sort();
  const parent = new Map(ids.map(id => [id, id]));
  const root = (id: string): string => { const up = parent.get(id)!; if (up === id) return id; const top = root(up); parent.set(id, top); return top; };
  for (let i = 0; i < ids.length; i += 1)
    for (let j = i + 1; j < ids.length; j += 1)
      if (hashDistance(hashes[ids[i]], hashes[ids[j]]) <= maxDistance && !skip.has(pairKey(ids[i], ids[j]))) parent.set(root(ids[i]), root(ids[j]));
  const groups = new Map<string, string[]>();
  ids.forEach(id => groups.set(root(id), [...(groups.get(root(id)) || []), id]));
  return [...groups.values()].filter(group => group.length > 1);
}

export type KeeperCandidate = { id: string; width?: number | null; height?: number | null; createdAt?: string | null; tags?: number; named?: boolean };

// The copy to keep: the largest, then the one with more tags or a real title, then the oldest.
export function pickKeeper(images: KeeperCandidate[]) {
  const area = (image: KeeperCandidate) => (image.width || 0) * (image.height || 0);
  return [...images].sort((a, b) => area(b) - area(a) || (b.tags || 0) - (a.tags || 0) || Number(!!b.named) - Number(!!a.named) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || a.id.localeCompare(b.id))[0]?.id || "";
}
