import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { discoverLibrary } from "@/lib/discover/data";
import type { ResearchSession } from "@/lib/discover/types";
import { DiscoverWorkspace } from "@/components/discover-workspace";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const db = await createClient();
  const { data, error } = await db.from("research_sessions").select().eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (error || !data) return <div><h1>Research session unavailable</h1><Link href="/discover">Back to Discover</Link></div>;
  const session = data as ResearchSession;
  const library = await discoverLibrary(user.id, session.result_snapshot);
  return <div className="discover-page"><Link href="/discover">Discover</Link><h1>Research session</h1>
    <p>{new Date(session.created_at).toLocaleString("en-US")}</p>
    <DiscoverWorkspace key={id} initial={session} collections={library.collections} matches={library.matches} />
  </div>;
}
