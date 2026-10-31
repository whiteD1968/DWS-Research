"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pinterestParent } from "@/lib/pinterest";
import { importPinterestBoard } from "@/lib/pinterest-sync";

// One round of a board import; the page calls it again with the returned bookmark until the board is done.
export async function importBoard(board: { id: string; name: string; description?: string }, bookmark = "") {
  if (!board || typeof board.id !== "string" || !/^\d{1,30}$/.test(board.id)) throw new Error("Choose a board.");
  const user = await requireUser(); const db = await createClient();
  const result = await importPinterestBoard(db, user.id, { id: board.id, name: String(board.name || "Pinterest board").slice(0, 200), description: typeof board.description === "string" ? board.description : "" }, typeof bookmark === "string" ? bookmark.slice(0, 2000) : "");
  if (result.done) { revalidatePath("/library"); revalidatePath("/collections"); }
  return result;
}

// Forgets the sign-in. Imported images and Collections stay.
export async function disconnectPinterest() {
  const user = await requireUser(); const db = await createClient();
  const { error } = await db.from("notes").delete().eq("owner_id", user.id).eq("parent_type", pinterestParent);
  if (error) throw new Error("Could not disconnect. Please retry.");
  revalidatePath("/library/pinterest");
}
