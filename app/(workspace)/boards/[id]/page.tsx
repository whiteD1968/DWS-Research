import { parseTransfer } from "@/lib/boards/handoff";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { boardCatalog } from "@/lib/boards/catalog";
import { ResearchBoardLoader } from "@/components/research-board-loader";
export default async function BoardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ add?: string; transfer?: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const db = await createClient();
  const { data: board } = await db.from("boards").select("*").eq("id", id).eq("owner_id", user.id).single();
  if (!board) notFound();
  const records = await boardCatalog(user.id);
  const query = await searchParams;
  const transfer = parseTransfer(query.add, query.transfer);
  return <ResearchBoardLoader board={board} ownerId={user.id} records={records} transfer={transfer} />;
}
