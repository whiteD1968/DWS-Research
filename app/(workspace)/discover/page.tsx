import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { discoverLibrary } from "@/lib/discover/data";
import { DiscoverWorkspace } from "@/components/discover-workspace";

export default async function DiscoverPage() {
  const user = await requireUser();
  const db = await createClient();
  const { data, error } = await db.from("research_sessions").select("id,title,created_at,result_snapshot,saved_items")
    .eq("owner_id", user.id).order("created_at", { ascending: false }).limit(12);
  const library = await discoverLibrary(user.id);
  return <div className="discover-page"><h1>Discover</h1><DiscoverWorkspace collections={library.collections} topics={library.topics} />
    {(error || library.error) && <p role="status">Research history is unavailable. Check the Discover migration and connection.</p>}
    <section className="discover-history"><h2>Recent research</h2>
      {!error && !data?.length && <p>No research sessions yet.</p>}
      {data?.map(session => <Link key={session.id} href={`/discover/sessions/${session.id}`}>
        <strong>{session.title}</strong><span>{new Date(session.created_at).toLocaleDateString("en-US")} &middot; {session.result_snapshot.length} results &middot; {Object.keys(session.saved_items).length} saved</span>
      </Link>)}
    </section></div>;
}
