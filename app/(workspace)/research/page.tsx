import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ownerRows, type Topic, type TopicLink } from "@/lib/research";
import { ResearchTopicForm } from "@/components/research-topic-form";

export default async function ResearchPage({ searchParams }: { searchParams: Promise<{ error?: string; status?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  let topics: Topic[] = [], links: TopicLink[] = [], error = params.error;
  try { [topics, links] = await Promise.all([ownerRows<Topic>("research_threads", user.id), ownerRows<TopicLink>("relationships", user.id)]); }
  catch { error = "Research topics could not be loaded. Please retry."; }
  const visible = topics.filter(topic => params.status === "archived" ? topic.status === "archived" : topic.status !== "archived").sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return <div className="research-workspace"><header className="page-header"><div><p className="eyebrow">Sustained inquiry</p><h1 className="page-title">Research</h1></div></header>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <details className="research-create"><summary>+ New Research Topic</summary><ResearchTopicForm /></details>
    <nav className="research-tabs"><Link href="/research" aria-current={params.status !== "archived" ? "page" : undefined}>Current</Link><Link href="/research?status=archived" aria-current={params.status === "archived" ? "page" : undefined}>Archived</Link></nav>
    <div className="research-index">{visible.map(topic => {
      const members = links.filter(link => link.source_type === "research_thread" && link.source_id === topic.id);
      const count = (type: string) => members.filter(link => link.target_type === type).length;
      return <Link href={`/research/${topic.id}`} className="research-topic-card" key={topic.id}><small>{topic.status}</small><h2>{topic.title}</h2><p>{topic.summary || topic.question}</p>
        <div className="research-counts"><span>{count("reference")} references</span><span>{count("media")} documents</span><span>{count("research_session")} searches</span></div>
        <small>Updated {new Date(topic.updated_at).toLocaleDateString("en-US")}</small></Link>;
    })}</div>{!visible.length && !error && <p>No topics yet.</p>}
  </div>;
}
