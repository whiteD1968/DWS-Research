import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImageFeatures } from "@/lib/similar";

export type LibraryImage = ImageFeatures & { title: string; tagIds: string[] };

// Every image with its tags and description text, for comparing images with each other.
export async function libraryImages(db: SupabaseClient, ownerId: string): Promise<LibraryImage[]> {
  const [{ data: media }, { data: tags }, links] = await Promise.all([
    db.from("media").select("id,title,original_filename,caption,alt_text").eq("owner_id", ownerId).eq("media_type", "image").not("storage_path", "is", null).order("created_at", { ascending: false }).limit(3000),
    db.from("tags").select("id,name").eq("owner_id", ownerId).limit(5000),
    mediaTagLinks(db, ownerId),
  ]);
  const nameOf = new Map((tags || []).map(tag => [String(tag.id), String(tag.name)]));
  const tagsOf = new Map<string, string[]>();
  links.forEach(link => { if (nameOf.has(link.tag_id)) tagsOf.set(link.record_id, [...(tagsOf.get(link.record_id) || []), link.tag_id]); });
  return (media || []).map(item => {
    const tagIds = tagsOf.get(String(item.id)) || [];
    return { id: String(item.id), title: item.title || item.original_filename || "Untitled", tagIds, tags: tagIds.map(id => nameOf.get(id)!), text: [item.caption, item.alt_text].filter(Boolean).join(" ").slice(0, 400) };
  });
}

async function mediaTagLinks(db: SupabaseClient, ownerId: string) {
  const links: { record_id: string; tag_id: string }[] = [];
  for (let from = 0; from < 30000; from += 1000) {
    const { data } = await db.from("record_tags").select("record_id,tag_id").eq("owner_id", ownerId).eq("record_type", "media").range(from, from + 999);
    links.push(...(data || []).map(row => ({ record_id: String(row.record_id), tag_id: String(row.tag_id) })));
    if (!data || data.length < 1000) break;
  }
  return links;
}
