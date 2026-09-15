import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ownerRows, type Topic, type TopicLink } from "@/lib/research";
import { ResearchTopicForm } from "@/components/research-topic-form";
import { researchArea, researchType, researchTypes } from "@/lib/research-organization";

export default async function ResearchPage({ searchParams }: { searchParams: Promise<{ error?: string; status?: string; area?: string; type?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  let topics: Topic[] = [], links: TopicLink[] = [], error = params.error;
  try { [topics, links] = await Promise.all([ownerRows<Topic>("research_threads", user.id), ownerRows<TopicLink>("relationships", user.id)]); }
  catch { error = "Research topics could not be loaded. Please retry."; }
  const visible = topics.filter(topic => (!params.status ? topic.status !== "archived" : params.status === "all" || topic.status === params.status) && (!params.area || researchArea(topic.metadata) === params.area) && (!params.type || researchType(topic.metadata) === params.type)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const areas = [...new Set(topics.map(topic => researchArea(topic.metadata)))].sort();
  const groups = [...new Set(visible.map(topic => researchArea(topic.metadata)))].sort();
  return <div className="research-workspace"><header className="page-header"><div><p className="eyebrow">Sustained inquiry</p><h1 className="page-title">Research</h1></div></header>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <details className="research-create"><summary>+ New Research Topic</summary><ResearchTopicForm /></details>
    <form className="research-inline" action="/research"><label>Status<select name="status" defaultValue={params.status ?? ""}><option value="">Current</option>{["all", "active", "developing", "paused", "archived"].map(status => <option key={status}>{status}</option>)}</select></label><label>Research Area<select name="area" defaultValue={params.area ?? ""}><option value="">All areas</option>{areas.map(area => <option key={area}>{area}</option>)}</select></label><label>Research Type<select name="type" defaultValue={params.type ?? ""}><option value="">All types</option>{researchTypes.map(type => <option key={type}>{type}</option>)}</select></label><button className="button">Filter</button><Link href="/research">Clear</Link></form>
    {groups.map(area => <section key={area}><h2 className="research-area-heading">{area}</h2><div className="research-index">{visible.filter(topic => researchArea(topic.metadata) === area).map(topic => {
      const members = links.filter(link => link.source_type === "research_thread" && link.source_id === topic.id);
      const count = (type: string) => members.filter(link => link.target_type === type).length;
      return <Link href={`/research/${topic.id}`} className="research-topic-card" key={topic.id}><h3>{topic.title}</h3><small>{researchType(topic.metadata)} &middot; {topic.status}</small><p>{topic.question || topic.summary}</p>
        <div className="research-counts"><span>{count("reference")} references</span><span>{count("media")} documents</span><span>{count("research_session")} searches</span></div>
        <small>Updated {new Date(topic.updated_at).toLocaleDateString("en-US")}</small></Link>;
    })}</div></section>)}{!visible.length && !error && <p>No topics match these filters.</p>}
  </div>;
}
