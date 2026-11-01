import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { boardCatalog } from "@/lib/boards/catalog";
import { BoardCreator } from "@/components/board-creator";
import { BoardList } from "@/components/board-list";
export default async function TopicBoards({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ boardPage?: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const db = await createClient();
  const { data: topic } = await db.from("research_threads").select("id,title").eq("id", id).eq("owner_id", user.id).single();
  if (!topic) notFound();
  const records = (await boardCatalog(user.id)).filter(r => r.topicIds.includes(id));
  return <section><Link href={`/research/${id}`}>← {topic.title}</Link><h1>Boards tagged {topic.title}</h1><p className="page-description">Every board carrying this topic, from any project. Tag a board with more topics from its title panel.</p><h2>Generate a board from this topic’s sources</h2><BoardCreator topicId={id} topicTitle={topic.title} records={records} /><h2>Boards</h2><BoardList ownerId={user.id} topicId={id} page={Number((await searchParams).boardPage || 1)} /></section>;
}
