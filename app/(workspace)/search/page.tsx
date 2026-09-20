import { WorkspaceSearchView } from "@/components/workspace-search-view";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isRecordKind, recordRoutes, searchPattern, type RecordKind } from "@/lib/records";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; page?: string }> }) {
  const user = await requireUser(); const db = await createClient(); const query = await searchParams;
  const text = (query.q || "").trim().slice(0, 120); const kind = isRecordKind(query.type || "") ? query.type as RecordKind : undefined;
  const page = Math.max(1, Math.min(10000, Math.floor(Number(query.page) || 1)));
  const kinds = kind ? [kind] : Object.keys(recordRoutes) as RecordKind[];
  const results = text ? await Promise.all(kinds.map(async type => {
    const offset = kind ? (page - 1) * 20 : 0;
    const result = await db.from(recordRoutes[type].table).select("id,title,updated_at", { count: "exact" }).eq("owner_id", user.id).ilike("title", searchPattern(text)).order("updated_at", { ascending: false }).order("id").range(offset, offset + 19);
    return { type, ...result };
  })) : [];
  return <WorkspaceSearchView text={text} kind={kind} page={page} results={results} />;
}
