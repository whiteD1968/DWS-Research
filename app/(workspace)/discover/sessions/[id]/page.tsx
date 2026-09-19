import { renameDiscoverSession } from "../../actions";
import { DeleteContent } from "@/components/content-controls";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { discoverLibrary } from "@/lib/discover/data";
import type { ResearchSession } from "@/lib/discover/types";
import { DiscoverWorkspace } from "@/components/discover-workspace";

export default async function SessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const db = await createClient();
  const { data, error } = await db.from("research_sessions").select().eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (error || !data) return <div><h1>Research session unavailable</h1><Link href="/discover">Back to Discover</Link></div>;
  const session = data as ResearchSession;
  const library = await discoverLibrary(user.id, session.result_snapshot);
  return <div className="discover-page"><Link href="/discover">Discover</Link><h1>{session.title}</h1>{query.error && <p className="notice notice-error" role="alert">{query.error}</p>}<details className="create-disclosure"><summary>Rename session</summary><form action={renameDiscoverSession} className="form-stack"><input name="session_id" type="hidden" value={id}/><label className="field"><span>Session title</span><input name="title" maxLength={200} required defaultValue={session.title}/></label><button className="button">Save title</button></form></details><DeleteContent kind="research_session" id={id} title={session.title} />
    <p>{new Date(session.created_at).toLocaleString("en-US")}</p>
    <DiscoverWorkspace key={id} initial={session} collections={library.collections} matches={library.matches} topics={library.topics} />
  </div>;
}
