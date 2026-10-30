/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BoardList } from "@/components/board-list";
import { JournalComposer } from "@/components/journal-composer";
import { thumbnailUrl } from "@/lib/thumbnails";
import { formatDay, journalParent, studioToday } from "@/lib/journal";
import { RemindersList } from "@/components/reminders-list";
import { dossierLinkGroup } from "@/lib/dossier";
import { leadFrom, leadParent, type Lead } from "@/lib/opportunity-scout";
import { OpportunityLeads, OpportunityScout } from "@/components/opportunity-leads";
import { opportunityFrom, opportunityParent, type Opportunity } from "@/lib/opportunities";
import { contactFrom, contactParent, type Contact } from "@/lib/contacts";
import { dossierParent, dossierSettingsParent, evidenceType, parseReviewDate } from "@/lib/dossier";
import { cvCategory, cvFields, cvParent } from "@/lib/cv";
import { agenda, glance, recentWork, summaryLine, type RecentItem } from "@/lib/practice";
import { PracticeAgenda, PracticeGlance, RecentWork } from "@/components/practice-dashboard";

export default async function TodayPage() {
  const user = await requireUser(); const db = await createClient();
  const [projects, topics] = await Promise.all([
    db.from("projects").select("id,title,summary,status").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(4),
    db.from("research_threads").select("id,title,question,status").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(4),
  ]);
  // The practice side: deadlines, people, the dossier, and what's been logged lately.
  const [oppRows, contactRows, statementRows, settings, evidence, cvRows, journalRows] = await Promise.all([
    db.from("notes").select("id,title,plain_text,metadata").eq("owner_id", user.id).eq("parent_type", opportunityParent).limit(1000),
    db.from("notes").select("id,title,plain_text,metadata").eq("owner_id", user.id).eq("parent_type", contactParent).limit(5000),
    db.from("notes").select("id,plain_text,metadata").eq("owner_id", user.id).eq("parent_type", dossierParent).order("created_at"),
    db.from("notes").select("metadata").eq("owner_id", user.id).eq("parent_type", dossierSettingsParent).limit(1).maybeSingle(),
    db.from("relationships").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("relationship_type", evidenceType),
    db.from("notes").select("id,title,metadata,created_at").eq("owner_id", user.id).eq("parent_type", cvParent).order("created_at", { ascending: false }).limit(1000),
    db.from("notes").select("id,title,plain_text,created_at").eq("owner_id", user.id).eq("parent_type", journalParent).order("created_at", { ascending: false }).limit(6),
  ]);
  // Today's jot pad links to any project or topic; the strip shows the newest journal sketches and photos.
  const [allProjects, allTopics, sketches, reminders, leadRows] = await Promise.all([
    db.from("projects").select("id,title").eq("owner_id", user.id).order("title").limit(300),
    db.from("research_threads").select("id,title").eq("owner_id", user.id).order("title").limit(300),
    db.from("relationships").select("source_id,target_id").eq("owner_id", user.id).eq("source_type", "note").eq("relationship_type", "has_media").order("created_at", { ascending: false }).limit(8),
    db.from("notes").select("id,title,plain_text,parent_type,metadata").eq("owner_id", user.id).not("metadata->>remind_at", "is", null).is("metadata->>done_at", null).order("metadata->>remind_at", { ascending: true }).limit(30),
    db.from("notes").select("id,title,plain_text,metadata").eq("owner_id", user.id).eq("parent_type", leadParent).order("created_at", { ascending: false }).limit(40),
  ]);
  const leads = (leadRows.data || []).map(leadFrom).filter((lead): lead is Lead => !!lead);
  const today = studioToday();
  const opportunities = (oppRows.data || []).map(opportunityFrom).filter((item): item is Opportunity => !!item);
  const contacts = (contactRows.data || []).map(contactFrom).filter((contact): contact is Contact => !!contact);
  const reviewDate = parseReviewDate((settings.data?.metadata as { review_date?: unknown })?.review_date) || "";
  // The first statement per section is the one the dossier shows, so only those count as drafted.
  const statements = new Map<string, string>();
  for (const row of statementRows.data || []) { const key = String((row.metadata as { section?: unknown })?.section || ""); if (!statements.has(key)) statements.set(key, row.plain_text || ""); }
  const cv = (cvRows.data || []).flatMap(row => { const fields = cvFields(row); return fields ? [{ ...fields, id: row.id as string, createdAt: String(row.created_at || "") }] : []; });
  const groups = agenda({ opportunities, contacts, reviewDate, today });
  const recent = recentWork([
    ...cv.slice(0, 6).map((entry): RecentItem => ({ at: entry.createdAt, kind: "cv", title: entry.title, detail: [cvCategory(entry.category).one, entry.venue].filter(Boolean).join(" · "), href: "/tenure/cv" })),
    ...(journalRows.data || []).map((row): RecentItem => ({ at: String(row.created_at || ""), kind: "journal", title: row.title || (row.plain_text || "").slice(0, 90) || "Journal entry", detail: row.title ? (row.plain_text || "").slice(0, 90) : "", href: `/library/items/note/${row.id}` })),
    ...opportunities.filter(item => item.status === "accepted" && item.decidedAt).map((item): RecentItem => ({ at: item.decidedAt, kind: "accepted", title: item.title, detail: item.organization, href: `/opportunities?o=${item.id}` })),
    ...contacts.filter(contact => contact.log[0]).map((contact): RecentItem => ({ at: `${contact.log[0].date}T00:00:00Z`, kind: "contact", title: contact.name, detail: contact.log[0].text, href: `/contacts?c=${contact.id}` })),
  ]);
  const links = [
    { label: "Projects", options: (allProjects.data || []).map(row => ({ value: `project:${row.id}`, label: row.title || "Untitled" })) },
    { label: "Research topics", options: (allTopics.data || []).map(row => ({ value: `research_thread:${row.id}`, label: row.title || "Untitled" })) },
    dossierLinkGroup,
  ];
  return <><header className="page-header"><div><p className="eyebrow">Dustin White Studio / Research desk</p><h1 className="page-title">Space to think.</h1><p className="page-description">{summaryLine(groups, today)}</p></div><Link className="button button-primary" href="/discover">Discover sources ↗</Link></header>
    <PracticeGlance glance={glance({ opportunities, contacts, reviewDate, statements: [...statements.values()], evidence: evidence.count ?? 0, cv, today })} />
    <div className="home-columns">
    <section className="today-card" aria-label="Today">
      <div className="today-card-head"><div><p className="eyebrow">Today</p><h2>{formatDay(today)}</h2></div><Link className="text-button" href="/journal">Open journal ↗</Link></div>
      <JournalComposer variant="home" links={links} />
      <RemindersList reminders={(reminders.data || []).map(row => ({ id: row.id, title: row.title || "", text: row.parent_type === "contact" ? "Follow up" : row.parent_type === "opportunity" ? `Deadline ${new Date(`${row.metadata?.deadline}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : (row.plain_text || "").slice(0, 160), remindAt: String(row.metadata?.remind_at || ""), href: row.parent_type === "opportunity" ? `/opportunities?o=${row.id}` : row.parent_type === "contact" ? `/contacts?c=${row.id}` : undefined }))} />
      {!!sketches.data?.length && <div className="today-sketches"><p className="eyebrow">Recent sketches</p><ul>{sketches.data.map(row => <li key={row.target_id}><Link href={`/library/items/media/${row.target_id}`}><img src={thumbnailUrl(row.target_id)} alt="Journal sketch" loading="lazy" /></Link></li>)}</ul></div>}
    </section>
    <PracticeAgenda groups={groups} />
    </div>
    <OpportunityLeads leads={leads} today={today} limit={4} showAllHref="/opportunities" /><OpportunityScout />
    <section className="home-recent section-block"><RecentWork items={recent} />{[{ title: "Recent inquiries", href: "/research", result: topics }, { title: "Project work", href: "/projects", result: projects }].map(group => <section className="desk-section" key={group.href}><div className="section-heading"><h2>{group.title}</h2><Link href={group.href}>View all ↗</Link></div>{group.result.error ? <p role="alert">Could not load this section.</p> : group.result.data?.length ? group.result.data.map(item => <Link className="desk-row" key={item.id} href={`${group.href}/${item.id}`}><span className="record-meta">{item.status}</span><h3>{item.title}</h3></Link>) : <p className="panel-copy">Start your first {group.href === "/research" ? "research topic" : "project"} to see it here.</p>}</section>)}</section>
    <section className="section-block"><div className="section-heading"><h2>On the wall</h2><Link href="/boards">All boards ↗</Link></div><BoardList ownerId={user.id} preview /></section>
  </>;
}
