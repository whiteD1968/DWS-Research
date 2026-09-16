import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { boardCatalog } from "@/lib/boards/catalog";
import { ResearchBoardLoader } from "@/components/research-board-loader";
export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const db = await createClient();
  const { data: board } = await db.from("boards").select("*").eq("id", id).eq("owner_id", user.id).single();
  if (!board) notFound();
  const records = await boardCatalog(user.id);
  return <ResearchBoardLoader board={board} ownerId={user.id} records={records} />;
}
