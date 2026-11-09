import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { faviconUrl, weblinkFrom, weblinkParent, weblinkProjectType, type Weblink } from "@/lib/weblinks";

// The web links filed into a project, each opening inside the site or in its own tab.
export async function ProjectLinks({ projectId }: { projectId: string }) {
  const user = await requireUser(); const db = await createClient();
  const { data: rels } = await db.from("relationships").select("source_id").eq("owner_id", user.id).eq("source_type", "note").eq("relationship_type", weblinkProjectType).eq("target_type", "project").eq("target_id", projectId).limit(1000);
  const ids = (rels || []).map(rel => rel.source_id as string);
  const rows: unknown[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await db.from("notes").select("id,title,plain_text,metadata,created_at").eq("owner_id", user.id).eq("parent_type", weblinkParent).in("id", ids.slice(i, i + 150));
    rows.push(...(data || []));
  }
  const links = (rows as Parameters<typeof weblinkFrom>[0][]).map(weblinkFrom).filter((link): link is Weblink => !!link).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return <section className="section-block project-links">
    <div className="section-heading"><h2>Links</h2><span className="record-meta">{links.length} saved</span><Link className="button" href={`/links?project=${projectId}`}>Manage links</Link></div>
    {links.length ? <ul className="links-list">{links.map(link => <li key={link.id} className="link-row">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="link-favicon" src={faviconUrl(link.domain)} alt="" width={20} height={20} loading="lazy" referrerPolicy="no-referrer" />
      <div className="link-body"><Link href={`/links/${link.id}`} className="link-title">{link.title}</Link><span className="link-meta">{link.domain}{link.description ? ` · ${link.description}` : ""}</span>
        {link.tags.length > 0 && <span className="link-chips">{link.tags.map(tag => <Link key={tag} className="link-tag" href={`/links?tag=${encodeURIComponent(tag)}`}>{tag}</Link>)}</span>}</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {link.image ? <Link href={`/links/${link.id}`} className="link-thumb" tabIndex={-1} aria-hidden="true"><img src={link.image} alt="" loading="lazy" referrerPolicy="no-referrer" /></Link> : <span />}
      <div className="link-actions"><Link className="cv-kind" href={`/links/${link.id}`}>Open</Link><a className="cv-kind" href={link.url} target="_blank" rel="noreferrer" aria-label={`Open ${link.title} in a new tab`}>↗</a></div>
    </li>)}</ul> : <div className="empty-state"><h2>No links in this project yet.</h2><p>On the Links page, select links and choose <strong>Add to project</strong>, or pick this project when you save a batch of tabs.</p><Link className="button button-primary" href={`/links?project=${projectId}`}>Go to Links</Link></div>}
  </section>;
}
