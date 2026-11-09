import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchPageInfo } from "@/lib/weblink-fetch";
import { autoTags, embedUrl, mergeTags, parseTags, weblinkFrom, weblinkParent, weblinkProjectType } from "@/lib/weblinks";
import { LinkReader } from "@/components/link-reader";

export const metadata = { title: "Link" };

export default async function LinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser(); const db = await createClient();
  const { data: row } = await db.from("notes").select("id,title,plain_text,metadata,created_at").eq("owner_id", user.id).eq("parent_type", weblinkParent).eq("id", id).maybeSingle();
  if (!row) notFound();
  let meta = (row.metadata || {}) as Record<string, unknown>;
  let title = row.title as string | null;
  // A link that hasn't been checked yet is read now, so the page knows whether it can be shown inside the site.
  const changes: Record<string, unknown> = {};
  if (meta.frame !== "ok" && meta.frame !== "blocked" && !meta.checked_at) {
    const list = await headers(); const host = list.get("x-forwarded-host") || list.get("host");
    const info = await fetchPageInfo(String(meta.url), host ? `${list.get("x-forwarded-proto") || "https"}://${host}` : "", 5000);
    Object.assign(changes, { frame: info?.frame ?? "unknown", checked_at: new Date().toISOString() });
    if (info) {
      Object.assign(changes, { description: info.description || meta.description || "", site_name: info.siteName, image: info.image });
      title = title || info.title || null;
      if (meta.auto !== false) changes.tags = mergeTags(parseTags(meta.tags), autoTags(String(meta.url), title || "", info.description));
    }
  }
  if (!meta.opened_at) changes.opened_at = new Date().toISOString();
  if (Object.keys(changes).length) {
    meta = { ...meta, ...changes };
    await db.from("notes").update({ title, metadata: meta }).eq("owner_id", user.id).eq("id", id);
  }
  const link = weblinkFrom({ ...row, title, metadata: meta })!;
  const [{ data: rels }, { data: projects }] = await Promise.all([
    db.from("relationships").select("target_id").eq("owner_id", user.id).eq("source_type", "note").eq("source_id", id).eq("relationship_type", weblinkProjectType),
    db.from("projects").select("id,title").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(500),
  ]);
  const linked = new Set((rels || []).map(rel => rel.target_id as string));
  return <LinkReader link={link} embed={embedUrl(link.url)} projects={(projects || []) as { id: string; title: string }[]} linkedProjects={[...linked]} />;
}
