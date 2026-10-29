/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BoardList } from "@/components/board-list";
import { JournalComposer } from "@/components/journal-composer";
import { thumbnailUrl } from "@/lib/thumbnails";
import { formatDay, studioToday } from "@/lib/journal";
import { RemindersList } from "@/components/reminders-list";
import { dossierLinkGroup } from "@/lib/dossier";
export default async function TodayPage() {
  const user = await requireUser(); const db = await createClient();
  const [projects, topics, references] = await Promise.all([
    db.from("projects").select("id,title,summary,status").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(4),
    db.from("research_threads").select("id,title,question,status").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(4),
    db.from("references").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
  ]);
  // Today's jot pad links to any project or topic; the strip shows the newest journal sketches and photos.
  const [allProjects, allTopics, sketches, reminders] = await Promise.all([
    db.from("projects").select("id,title").eq("owner_id", user.id).order("title").limit(300),
    db.from("research_threads").select("id,title").eq("owner_id", user.id).order("title").limit(300),
    db.from("relationships").select("source_id,target_id").eq("owner_id", user.id).eq("source_type", "note").eq("relationship_type", "has_media").order("created_at", { ascending: false }).limit(8),
    db.from("notes").select("id,title,plain_text,parent_type,metadata").eq("owner_id", user.id).not("metadata->>remind_at", "is", null).is("metadata->>done_at", null).order("metadata->>remind_at", { ascending: true }).limit(30),
  ]);
  const links = [
    { label: "Projects", options: (allProjects.data || []).map(row => ({ value: `project:${row.id}`, label: row.title || "Untitled" })) },
    { label: "Research topics", options: (allTopics.data || []).map(row => ({ value: `research_thread:${row.id}`, label: row.title || "Untitled" })) },
    dossierLinkGroup,
  ];
  return <><header className="page-header"><div><p className="eyebrow">Dustin White Studio / Research desk</p><h1 className="page-title">Space to think.</h1><p className="page-description">Return to an inquiry, gather a new perspective, or compose your next direction.</p></div><Link className="button button-primary" href="/discover">Discover sources ↗</Link></header>
    <section className="today-card" aria-label="Today">
      <div className="today-card-head"><div><p className="eyebrow">Today</p><h2>{formatDay(studioToday())}</h2></div><Link className="text-button" href="/journal">Open journal ↗</Link></div>
      <JournalComposer variant="home" links={links} />
      <RemindersList reminders={(reminders.data || []).map(row => ({ id: row.id, title: row.title || "", text: row.parent_type === "opportunity" ? `Deadline ${new Date(`${row.metadata?.deadline}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : (row.plain_text || "").slice(0, 160), remindAt: String(row.metadata?.remind_at || ""), href: row.parent_type === "opportunity" ? "/opportunities" : undefined }))} />
      {!!sketches.data?.length && <div className="today-sketches"><p className="eyebrow">Recent sketches</p><ul>{sketches.data.map(row => <li key={row.target_id}><Link href={`/library/items/media/${row.target_id}`}><img src={thumbnailUrl(row.target_id)} alt="Journal sketch" loading="lazy" /></Link></li>)}</ul></div>}
    </section>
    <div className="desk-links"><Link href="/research"><span>01 / Investigate</span><strong>Research topics</strong></Link><Link href="/boards"><span>02 / Compose</span><strong>Visual boards</strong></Link><Link href="/library"><span>03 / Revisit</span><strong>Source library</strong><small>{references.count ?? "—"} saved references</small></Link></div>
    <section className="workspace-grid section-block">{[{ title: "Recent inquiries", href: "/research", result: topics }, { title: "Project work", href: "/projects", result: projects }].map(group => <section className="desk-section" key={group.href}><div className="section-heading"><h2>{group.title}</h2><Link href={group.href}>View all ↗</Link></div>{group.result.error ? <p role="alert">Could not load this section.</p> : group.result.data?.length ? group.result.data.map(item => <Link className="desk-row" key={item.id} href={`${group.href}/${item.id}`}><span className="record-meta">{item.status}</span><h3>{item.title}</h3></Link>) : <p className="panel-copy">Start your first {group.href === "/research" ? "research topic" : "project"} to see it here.</p>}</section>)}</section>
    <section className="section-block"><div className="section-heading"><h2>On the wall</h2><Link href="/boards">All boards ↗</Link></div><BoardList ownerId={user.id} preview /></section>
  </>;
}
