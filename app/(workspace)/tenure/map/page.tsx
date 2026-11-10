import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseLog, parseMap, researchMapParent, researchMapSnapshotParent } from "@/lib/research-map";
import { seedMap } from "@/lib/research-map-seed";
import { ResearchMapEditor } from "@/components/research-map-editor";

export const metadata = { title: "Research map" };

export default async function ResearchMapPage() {
  const user = await requireUser(); const db = await createClient();
  const [current, snapshots, projects] = await Promise.all([
    db.from("notes").select("metadata,updated_at").eq("owner_id", user.id).eq("parent_type", researchMapParent).limit(1).maybeSingle(),
    db.from("notes").select("id,title,metadata,created_at").eq("owner_id", user.id).eq("parent_type", researchMapSnapshotParent).order("created_at", { ascending: false }).limit(50),
    db.from("projects").select("id,title").eq("owner_id", user.id).order("title").limit(500),
  ]);
  const meta = (current.data?.metadata || {}) as { map?: unknown; log?: unknown };
  const map = parseMap(meta.map) || seedMap;
  const saved = (snapshots.data || []).flatMap(row => { const snap = parseMap((row.metadata as { map?: unknown })?.map); return snap ? [{ id: row.id as string, name: (row.title as string) || "Snapshot", createdAt: row.created_at as string, map: snap }] : []; });
  return <div className="research-map-page">
    <header className="page-header"><div><p className="eyebrow">Tenure &amp; promotion</p><h1 className="page-title">Research map</h1><p className="page-description">Your research framework as a transit map. Edit the content in the panel and drag stations, bends and labels on the map; the drawing, legend and checks update as you go. Export SVG for Illustrator or InDesign, and save a snapshot at each review.</p></div></header>
    {(current.error || snapshots.error) && <p className="notice notice-error" role="alert">Part of your map could not be loaded. Please refresh before editing.</p>}
    <ResearchMapEditor initial={map} isNew={!current.data} log={parseLog(meta.log)} snapshots={saved} projects={(projects.data || []).map(row => ({ id: row.id as string, title: row.title as string }))} />
  </div>;
}
