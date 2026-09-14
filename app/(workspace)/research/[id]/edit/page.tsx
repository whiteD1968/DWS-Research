import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ResearchTopicForm } from "@/components/research-topic-form";
import type { Topic } from "@/lib/research";

export default async function EditTopic({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const db = await createClient();
  const { data, error } = await db.from("research_threads").select("*").eq("id", id).eq("owner_id", user.id).single();
  if (error || !data) return <p role="alert">Research topic unavailable. <Link href="/research">Research</Link></p>;
  return <div className="research-workspace"><Link href={`/research/${id}`}>Back to topic</Link><h1>Edit topic</h1><ResearchTopicForm topic={data as Topic} /></div>;
}
