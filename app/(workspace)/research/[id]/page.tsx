import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { topicContext, topicModes } from "@/lib/research";
import { ResearchTopicWorkspace } from "@/components/research-topic-workspace";

export default async function TopicPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string; error?: string; saved?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  if (query.mode === "boards") redirect(`/research/${id}/boards`);
  let context;
  try { context = await topicContext(user.id); }
  catch { return <p role="alert">Research workspace could not be loaded. <Link href="/research">Back to research</Link></p>; }
  const topic = context.topics.find(item => item.id === id);
  if (!topic) return <p>Topic unavailable. <Link href="/research">Research</Link></p>;
  return <ResearchTopicWorkspace topic={topic} context={context} mode={topicModes.includes(query.mode ?? "") ? query.mode! : "overview"} error={query.error} saved={!!query.saved} />;
}
