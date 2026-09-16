import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
export async function BoardList({ ownerId, topicId }: { ownerId: string; topicId?: string }) {
  const db = await createClient();
  let query = db.from("boards").select("id,title,board_type,created_at,updated_at,board_items(count)").eq("owner_id", ownerId).order("updated_at", { ascending: false });
  if (topicId) query = query.eq("research_thread_id", topicId);
  const { data, error } = await query;
  if (error) return <p role="alert">Boards could not be loaded.</p>;
  return <div className="board-list">{data.length ? data.map(b => <Link href={`/boards/${b.id}`} key={b.id}><strong>{b.title}</strong><span>{b.board_type.replaceAll("_", " ")} / {b.board_items[0]?.count || 0} records</span><small>Created {new Date(b.created_at).toLocaleDateString("en-US")} / Updated {new Date(b.updated_at).toLocaleDateString("en-US")}</small></Link>) : <p>No boards yet.</p>}</div>;
}
