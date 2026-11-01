"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { boardTopicLinks, isUuid } from "@/lib/boards/organization";

async function checkOwnership(db: SupabaseClient, ownerId: string, projectId: string | null, topicIds: string[]) {
  if (projectId) {
    const { data } = await db.from("projects").select("id").eq("id", projectId).eq("owner_id", ownerId).single();
    if (!data) throw new Error("That project is unavailable.");
  }
  if (topicIds.length) {
    const { data } = await db.from("research_threads").select("id").eq("owner_id", ownerId).in("id", topicIds);
    if ((data ?? []).length !== topicIds.length) throw new Error("A selected topic is unavailable.");
  }
}

async function syncTopicLinks(db: SupabaseClient, ownerId: string, boardId: string, topicIds: string[]) {
  const current = (await boardTopicLinks(db, ownerId, [boardId])).map(link => link.source_id);
  const removed = current.filter(id => !topicIds.includes(id));
  const added = topicIds.filter(id => !current.includes(id));
  if (removed.length) {
    const { error } = await db.from("relationships").delete().eq("owner_id", ownerId).eq("source_type", "research_thread").eq("relationship_type", "has_board").eq("target_type", "board").eq("target_id", boardId).in("source_id", removed);
    if (error) throw new Error("Topics could not be updated. Retry.");
  }
  if (added.length) {
    const { error } = await db.from("relationships").upsert(added.map(id => ({ owner_id: ownerId, source_type: "research_thread", source_id: id, relationship_type: "has_board", target_type: "board", target_id: boardId })), { onConflict: "source_type,source_id,relationship_type,target_type,target_id", ignoreDuplicates: true });
    if (error) throw new Error("Topics could not be updated. Retry.");
  }
}

function readPlacement(projectValue: unknown, topicValues: unknown[]) {
  const projectId = isUuid(projectValue) ? projectValue : null;
  const topicIds = [...new Set(topicValues.filter(isUuid))].slice(0, 50);
  return { projectId, topicIds };
}

// Blank board, started from the Boards page or inside a project.
export async function createBoard(formData: FormData) {
  const user = await requireUser();
  const db = await createClient();
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  if (!title) throw new Error("Board title required.");
  const { projectId, topicIds } = readPlacement(formData.get("project_id"), formData.getAll("topic_id"));
  await checkOwnership(db, user.id, projectId, topicIds);
  const { data, error } = await db.from("boards").insert({ owner_id: user.id, project_id: projectId, research_thread_id: topicIds[0] ?? null, title, board_type: "freeform", metadata: {} }).select("id").single();
  if (error || !data) throw new Error("Unable to create board.");
  await syncTopicLinks(db, user.id, data.id, topicIds.slice(1));
  revalidatePath("/boards");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  redirect(`/boards/${data.id}`);
}

// Move a board into a project (or back to loose ideas) and set its topics. Returns the new revision.
export async function organizeBoard(id: string, project: string | null, topics: string[], revision: string) {
  const user = await requireUser();
  const db = await createClient();
  const { projectId, topicIds } = readPlacement(project, topics);
  const { data: board } = await db.from("boards").select("id,project_id,research_thread_id").eq("id", id).eq("owner_id", user.id).single();
  if (!board) throw new Error("Board not found.");
  await checkOwnership(db, user.id, projectId, topicIds);
  // Keep the original topic column pointing at one of the chosen topics, so topic-based tools keep working.
  const primaryTopic = board.research_thread_id && topicIds.includes(board.research_thread_id) ? board.research_thread_id : topicIds[0] ?? null;
  let next = revision;
  if (board.project_id !== projectId || board.research_thread_id !== primaryTopic) {
    const { data, error } = await db.from("boards").update({ project_id: projectId, research_thread_id: primaryTopic }).eq("id", id).eq("owner_id", user.id).eq("updated_at", revision).select("updated_at").single();
    if (error || !data) throw new Error("Board changed or could not be moved. Reload and retry.");
    next = data.updated_at as string;
  }
  await syncTopicLinks(db, user.id, id, topicIds.filter(topicId => topicId !== primaryTopic));
  revalidatePath("/boards");
  for (const projectRef of new Set([board.project_id, projectId])) if (projectRef) revalidatePath(`/projects/${projectRef}`);
  return { revision: next, projectId, topicIds };
}
