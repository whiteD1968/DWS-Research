"use server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveBoard } from "./actions";

export async function copyRecoveredBoard(sourceId: string, copyId: string, snapshot: unknown) {
  const user = await requireUser(); const db = await createClient();
  if (!/^[\da-f-]{36}$/i.test(copyId)) throw new Error("Invalid recovery request.");
  const { data: source } = await db.from("boards").select("title,research_thread_id").eq("id", sourceId).eq("owner_id", user.id).single();
  if (!source || sourceId === copyId) throw new Error("Board not found.");
  const { error } = await db.from("boards").upsert({ id: copyId, owner_id: user.id, title: `${source.title.slice(0, 175)} — Recovered`, research_thread_id: source.research_thread_id, board_type: "freeform", metadata: { recovered_from: sourceId } }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error("Could not create recovered board. Your draft is retained.");
  const { data: copy } = await db.from("boards").select("updated_at,snapshot,metadata").eq("id", copyId).eq("owner_id", user.id).single();
  if (!copy || copy.metadata?.recovered_from !== sourceId) throw new Error("Recovery destination unavailable.");
  if (copy.snapshot == null) await saveBoard(copyId, copy.updated_at, snapshot);
  return copyId;
}
