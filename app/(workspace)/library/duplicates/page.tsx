import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadFingerprints } from "@/lib/image-fingerprints";
import { duplicateGroups, pickKeeper } from "@/lib/image-hash";
import { looksLikeFilename } from "@/lib/image-tags";
import { DuplicateFinder, type DuplicateImage } from "@/components/duplicate-finder";

export const maxDuration = 60;

export default async function DuplicatesPage() {
  const user = await requireUser(); const db = await createClient();
  const [{ data: media }, store] = await Promise.all([
    db.from("media").select("id,title,original_filename,width,height,created_at,metadata").eq("owner_id", user.id).eq("media_type", "image").not("storage_path", "is", null).order("created_at", { ascending: false }).limit(5000),
    loadFingerprints(db, user.id),
  ]);
  const images = new Map((media || []).map(item => [String(item.id), item]));
  const hashes = Object.fromEntries(Object.entries(store?.hashes || {}).filter(([id]) => images.has(id)));
  const unreadable = new Set(Array.isArray(store?.metadata.unreadable) ? (store!.metadata.unreadable as string[]) : []);
  const unchecked = [...images.keys()].filter(id => !hashes[id] && !unreadable.has(id)).length;
  const groupIds = duplicateGroups(hashes, 8, store?.distinct || []);
  const inGroups = groupIds.flat();
  const tagCounts = new Map<string, number>();
  for (let i = 0; i < inGroups.length; i += 200) {
    const { data } = await db.from("record_tags").select("record_id").eq("owner_id", user.id).eq("record_type", "media").in("record_id", inGroups.slice(i, i + 200));
    (data || []).forEach(row => tagCounts.set(String(row.record_id), (tagCounts.get(String(row.record_id)) || 0) + 1));
  }
  const groups = groupIds.map(ids => {
    const members: DuplicateImage[] = ids.map(id => {
      const item = images.get(id)!;
      const pinterest = (item.metadata as { pinterest?: { board?: string } } | null)?.pinterest;
      return { id, title: item.title || item.original_filename || "Untitled", width: item.width || 0, height: item.height || 0, createdAt: String(item.created_at || ""), tags: tagCounts.get(id) || 0, source: pinterest ? `Pinterest${pinterest.board ? ` · ${pinterest.board}` : ""}` : "Uploaded", named: !looksLikeFilename(item.title, item.original_filename) };
    });
    const keep = pickKeeper(members);
    return { keep, images: [...members].sort((a, b) => Number(b.id === keep) - Number(a.id === keep)) };
  }).sort((a, b) => b.images.length - a.images.length);
  return <>
    <nav className="breadcrumb-row"><Link href="/library?view=images">Library / images</Link><span>/</span><span>Duplicates</span></nav>
    <header className="page-header"><div><p className="eyebrow">Tidy up</p><h1 className="page-title">Duplicate images</h1>
      <p className="page-description">Images that look the same, even at a different size or saved twice from Pinterest. Pick the copy to keep: the others are deleted, and their tags, collections, board spots and links move to the one you keep.</p></div></header>
    <DuplicateFinder groups={groups} unchecked={unchecked} total={images.size} />
  </>;
}
