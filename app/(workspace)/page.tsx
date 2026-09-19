import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BoardList } from "@/components/board-list";
export default async function TodayPage() {
  const user = await requireUser(); const db = await createClient();
  const [projects, topics, references] = await Promise.all([
    db.from("projects").select("id,title,summary,status").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(4),
    db.from("research_threads").select("id,title,question,status").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(4),
    db.from("references").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
  ]);
  return <><header className="page-header"><div><p className="eyebrow">Dustin White Studio / Research desk</p><h1 className="page-title">Space to think.</h1><p className="page-description">Return to an inquiry, gather a new perspective, or compose your next direction.</p></div><Link className="button button-primary" href="/discover">Discover sources ↗</Link></header>
    <div className="desk-links"><Link href="/research"><span>01 / Investigate</span><strong>Research topics</strong></Link><Link href="/boards"><span>02 / Compose</span><strong>Visual boards</strong></Link><Link href="/library"><span>03 / Revisit</span><strong>Source library</strong><small>{references.count ?? "—"} saved references</small></Link></div>
    <section className="workspace-grid section-block">{[{ title: "Recent inquiries", href: "/research", result: topics }, { title: "Project work", href: "/projects", result: projects }].map(group => <section className="desk-section" key={group.href}><div className="section-heading"><h2>{group.title}</h2><Link href={group.href}>View all ↗</Link></div>{group.result.error ? <p role="alert">Could not load this section.</p> : group.result.data?.length ? group.result.data.map(item => <Link className="desk-row" key={item.id} href={`${group.href}/${item.id}`}><span className="record-meta">{item.status}</span><h3>{item.title}</h3></Link>) : <p className="panel-copy">Start your first {group.href === "/research" ? "research topic" : "project"} to see it here.</p>}</section>)}</section>
    <section className="section-block"><div className="section-heading"><h2>On the wall</h2><Link href="/boards">All boards ↗</Link></div><BoardList ownerId={user.id} preview /></section>
  </>;
}
