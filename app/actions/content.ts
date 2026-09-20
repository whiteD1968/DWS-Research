"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { contentKinds, isContentKind } from "@/lib/content";

export async function deleteContent(kind: string, id: string, confirmation: string) {
  const user = await requireUser();
  if (!isContentKind(kind) || confirmation !== "DELETE") throw new Error("Confirm the deletion by typing DELETE.");
  const db = await createClient();
  const { data, error } = await db.from(contentKinds[kind].table).select("*").eq("id", id).eq("owner_id", user.id).single();
  if (error || !data) throw new Error("This content is unavailable. Refresh and try again.");
  // Keep the record available for retry if Storage cannot remove the original.
  if (kind === "media" && data.storage_path) {
    if (data.bucket !== "research-media" || !data.storage_path.startsWith(`${user.id}/`)) throw new Error("File location could not be verified.");
    const removed = await db.storage.from(data.bucket).remove([data.storage_path]);
    if (removed.error) throw new Error("The file could not be deleted. Nothing has been removed from your library. Please retry.");
  }
  const result = await db.rpc("delete_research_content", { p_kind: kind, p_id: id });
  if (result.error) throw new Error(kind === "media" ? "File removal completed but library cleanup failed. Retry deletion to finish." : "Deletion could not be completed. Please retry.");
  revalidatePath("/", "layout");
  return kind === "media" && data.media_type === "document" ? "/library?view=documents" : contentKinds[kind].destination;
}

export async function editLibraryContent(kind: "media" | "note", id: string, values: { title: string; text: string; altText?: string }) {
  const user = await requireUser();
  if (!["media", "note"].includes(kind) || !values || typeof values.title !== "string" || typeof values.text !== "string" || (values.altText !== undefined && typeof values.altText !== "string") || !values.title.trim() || values.title.length > 200 || values.text.length > 50000 || (values.altText?.length ?? 0) > 2000) throw new Error("Enter a title (up to 200 characters) and shorter content.");
  const db = await createClient();
  const update = kind === "media" ? { title: values.title.trim(), caption: values.text, alt_text: values.altText || null } : { title: values.title.trim(), plain_text: values.text };
  const { data, error } = await db.from(contentKinds[kind].table).update(update).eq("id", id).eq("owner_id", user.id).select("id").single();
  if (error || !data) throw new Error("Could not save. Refresh and try again.");
  revalidatePath("/", "layout");
}
