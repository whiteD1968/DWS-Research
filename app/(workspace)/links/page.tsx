import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { allWeblinkRows } from "@/lib/weblink-store";
import { imageTaggingReady } from "@/lib/image-tagger";
import { weblinkFrom, weblinkProjectType, type Weblink } from "@/lib/weblinks";
import { LinkShelf } from "@/components/link-shelf";

export const metadata = { title: "Links" };

export default async function LinksPage({ searchParams }: { searchParams: Promise<{ project?: string; tag?: string }> }) {
  const user = await requireUser(); const db = await createClient(); const params = await searchParams;
  const [{ rows, error }, { data: projects }] = await Promise.all([
    allWeblinkRows<{ id: string; title: string | null; plain_text: string | null; metadata: unknown; created_at: string }>(db, user.id, "id,title,plain_text,metadata,created_at"),
    db.from("projects").select("id,title").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(500),
  ]);
  const links = rows.map(weblinkFrom).filter((link): link is Weblink => !!link);
  const memberships: { linkId: string; projectId: string }[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await db.from("relationships").select("source_id,target_id").eq("owner_id", user.id).eq("source_type", "note").eq("relationship_type", weblinkProjectType).eq("target_type", "project").order("id").range(from, from + 999);
    memberships.push(...(data || []).map(rel => ({ linkId: rel.source_id as string, projectId: rel.target_id as string })));
    if (!data || data.length < 1000) break;
  }
  return <div className="links-page">
    <header className="page-header"><div><p className="eyebrow">Library</p><h1 className="page-title">Links</h1><p className="page-description">Save every open tab in one go, let the tags sort them, file the keepers into projects, and read them right here.</p></div></header>
    {error && <p className="notice notice-error" role="alert">Some links could not be loaded. Please retry.</p>}
    <LinkShelf links={links} projects={(projects || []) as { id: string; title: string }[]} memberships={memberships} smartTagging={imageTaggingReady()} initialProject={params.project} initialTag={params.tag} />
  </div>;
}
