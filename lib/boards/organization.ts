import type { SupabaseClient } from "@supabase/supabase-js";

// A board can sit inside one project (or none, as a loose idea) and carry any number of topics.
// Topics come from the board's original research_thread_id plus research_thread → board "has_board" links.
export type BoardPlacement = { projectId: string | null; topicIds: string[] };
export type NamedOption = { id: string; title: string };

export const isUuid = (value: unknown): value is string => typeof value === "string" && /^[\da-f-]{36}$/i.test(value);

export function boardTopicIds(board: { id: string; research_thread_id?: string | null }, links: { source_id: string; target_id: string }[]) {
  return [...new Set([...(board.research_thread_id ? [board.research_thread_id] : []), ...links.filter(link => link.target_id === board.id).map(link => link.source_id)])];
}

export async function boardTopicLinks(db: SupabaseClient, ownerId: string, boardIds?: string[]) {
  if (boardIds && !boardIds.length) return [];
  let query = db.from("relationships").select("source_id,target_id").eq("owner_id", ownerId).eq("source_type", "research_thread").eq("relationship_type", "has_board").eq("target_type", "board");
  if (boardIds) query = query.in("target_id", boardIds);
  const { data } = await query;
  return (data ?? []) as { source_id: string; target_id: string }[];
}

export async function organizationOptions(db: SupabaseClient, ownerId: string) {
  const [projects, topics] = await Promise.all([
    db.from("projects").select("id,title").eq("owner_id", ownerId).order("title"),
    db.from("research_threads").select("id,title").eq("owner_id", ownerId).order("title"),
  ]);
  return { projects: (projects.data ?? []) as NamedOption[], topics: (topics.data ?? []) as NamedOption[] };
}

// Group boards for menus: loose ideas first, then each project alphabetically.
export function groupBoards<T extends { project_id: string | null }>(boards: T[], projects: NamedOption[]) {
  const groups: { id: string | null; title: string; boards: T[] }[] = [];
  const loose = boards.filter(board => !board.project_id);
  if (loose.length) groups.push({ id: null, title: "Loose ideas", boards: loose });
  for (const project of projects) {
    const inProject = boards.filter(board => board.project_id === project.id);
    if (inProject.length) groups.push({ id: project.id, title: project.title, boards: inProject });
  }
  const orphaned = boards.filter(board => board.project_id && !projects.some(project => project.id === board.project_id));
  if (orphaned.length) groups.push({ id: null, title: "Other boards", boards: orphaned });
  return groups;
}
