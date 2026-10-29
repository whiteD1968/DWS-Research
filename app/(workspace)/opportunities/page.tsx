import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { studioToday } from "@/lib/journal";
import { opportunityFrom, opportunityParent, seasonStats, sortByDeadline, type Opportunity } from "@/lib/opportunities";
import { OpportunityBoard } from "@/components/opportunity-board";

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const user = await requireUser(); const db = await createClient(); const params = await searchParams;
  const { data, error } = await db.from("notes").select("id,title,plain_text,metadata").eq("owner_id", user.id).eq("parent_type", opportunityParent).limit(1000);
  const today = studioToday(); const year = today.slice(0, 4);
  const all = (data || []).map(opportunityFrom).filter((item): item is Opportunity => !!item).sort(sortByDeadline);
  // Decided items stay visible for the current year; older results drop off the board but still count in the Library.
  const items = all.filter(item => item.status !== "withdrawn" && !(["accepted", "declined"].includes(item.status) && item.decidedAt && item.decidedAt.slice(0, 4) < year));
  const stats = seasonStats(all, year);
  const next = items.find(item => item.deadline >= today && (item.status === "interested" || item.status === "preparing"));
  return <div className="opp-page">
    <header className="page-header"><div><p className="eyebrow">Practice</p><h1 className="page-title">Opportunities</h1><p className="page-description">Calls, grants, residencies, and jobs, from first look to the result.</p></div></header>
    {error && <p className="notice notice-error" role="alert">Opportunities could not be loaded. Please retry.</p>}
    <section className="opp-stats" aria-label={`${year} so far`}>
      <div><span>Next deadline</span><strong>{next ? next.title : "Nothing due"}</strong>{next && <small>{new Date(`${next.deadline}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}</small>}</div>
      <div><span>Submitted in {year}</span><strong>{stats.submitted}</strong></div>
      <div><span>Accepted</span><strong>{stats.accepted}{stats.rate !== null && <small> · {stats.rate}%</small>}</strong></div>
      <div><span>Fees paid</span><strong>${stats.fees.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong></div>
    </section>
    <OpportunityBoard key={params.new === "1" ? "new" : "board"} items={items} today={today} startOpen={params.new === "1"} />
  </div>;
}
