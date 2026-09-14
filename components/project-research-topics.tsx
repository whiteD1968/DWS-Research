import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export async function ProjectResearchTopics({ projectId }: { projectId: string }) {
  const user = await requireUser();
  const db = await createClient();
  const { data: links, error } = await db.from("relationships").select("source_id").eq("owner_id", user.id).eq("source_type", "research_thread").eq("relationship_type", "informs_project").eq("target_type", "project").eq("target_id", projectId);
  const ids = links?.map(link => link.source_id) ?? [];
  const { data: topics, error: topicError } = ids.length ? await db.from("research_threads").select("id,title").eq("owner_id", user.id).in("id", ids) : { data: [], error: null };
  return <section className="section-block"><h2>Research Topics</h2>{error || topicError ? <p>Linked topics could not be loaded.</p> : topics?.length ? <div className="research-list">{topics.map(topic => <Link key={topic.id} href={`/research/${topic.id}`}>{topic.title}</Link>)}</div> : <p>No linked Research Topics.</p>}</section>;
}
