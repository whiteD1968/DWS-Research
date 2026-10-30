import Link from "next/link";
import type { agenda, Glance, RecentItem } from "@/lib/practice";
import { CalendarSubscribe } from "@/components/calendar-subscribe";
import { MorningEmail } from "@/components/morning-email";
import type { DigestSettings } from "@/lib/digest";

const kindLabels = { deadline: "Deadline", follow_up: "Follow up", review: "Review" } as const;
const recentLabels = { cv: "Logged to CV", journal: "Journal", accepted: "Accepted", contact: "In touch" } as const;

export function PracticeGlance({ glance }: { glance: Glance }) {
  const { applications, people, tenure, year } = glance;
  return <section className="glance" aria-label="Practice at a glance">
    <Link href={applications.next ? `/opportunities?o=${applications.next.id}` : "/opportunities"} className="glance-tile">
      <span>Next deadline</span>
      <strong>{applications.next ? applications.next.title : "Nothing due"}</strong>
      <small>{applications.next ? applications.nextLabel : "Add a call you’re considering"}{applications.active ? ` · ${applications.active} in progress` : ""}</small>
    </Link>
    <Link href="/contacts" className={people.due ? "glance-tile glance-tile-alert" : "glance-tile"}>
      <span>People</span>
      <strong>{people.due ? `${people.due} to follow up` : people.total ? "All caught up" : "No contacts yet"}</strong>
      <small>{people.quiet ? `${people.quiet} quiet for six months` : people.total ? `${people.total} in your contacts` : "Add curators, editors, and peers"}</small>
    </Link>
    <Link href="/tenure" className="glance-tile">
      <span>Tenure</span>
      <strong>{tenure.days === null ? "Set a review date" : tenure.label}</strong>
      <small>{tenure.written}/{tenure.sections} statements drafted · {tenure.evidence} {tenure.evidence === 1 ? "piece" : "pieces"} of evidence</small>
    </Link>
    <Link href="/tenure/cv" className="glance-tile">
      <span>{year.label} so far</span>
      <strong>{year.logged} on your CV</strong>
      <small>{[year.top, year.accepted ? `${year.accepted} accepted` : "", applications.waiting ? `${applications.waiting} waiting to hear` : ""].filter(Boolean).join(" · ") || "Log something when you finish it"}</small>
    </Link>
  </section>;
}

export function PracticeAgenda({ groups, digest, digestError }: { groups: ReturnType<typeof agenda>; digest: DigestSettings; digestError: string }) {
  return <section className="agenda" aria-label="Next two weeks">
    <div className="agenda-head"><p className="eyebrow">Next two weeks</p><span className="agenda-tools"><MorningEmail settings={digest} lastError={digestError} /><CalendarSubscribe /></span></div>
    {groups.length ? <ol className="agenda-days">{groups.map(group => <li key={group.day} className={group.label === "Today" ? "agenda-day agenda-today" : "agenda-day"}>
      <h3>{group.label}</h3>
      <ul>{group.items.map(item => <li key={`${item.kind}-${item.href}`}>
        <Link href={item.href} className={`agenda-item agenda-${item.kind}${item.overdue ? " agenda-overdue" : ""}`}>
          <span className="agenda-kind">{kindLabels[item.kind]}</span>
          <strong>{item.title}</strong>
          {item.detail && <small>{item.detail}</small>}
        </Link>
      </li>)}</ul>
    </li>)}</ol> : <p className="agenda-empty">No deadlines, follow-ups, or reviews in the next two weeks.</p>}
  </section>;
}

export function RecentWork({ items }: { items: RecentItem[] }) {
  if (!items.length) return null;
  return <section className="desk-section recent-work" aria-label="Recent work">
    <div className="section-heading"><h2>Recent work</h2><Link href="/tenure/cv">CV ↗</Link></div>
    <ul>{items.map(item => <li key={`${item.kind}-${item.href}-${item.at}`}><Link href={item.href} className="recent-row">
      <span className={`recent-kind recent-${item.kind}`}>{recentLabels[item.kind]}</span>
      <strong>{item.title}</strong>
      {item.detail && <small>{item.detail}</small>}
    </Link></li>)}</ul>
  </section>;
}
