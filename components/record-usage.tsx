import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { recordUsage, type Usage } from "@/lib/record-usage";
import { recordRoutes, type RecordKind } from "@/lib/records";

export async function RecordUsage({ kind, id }: { kind: RecordKind; id: string }) {
  const user = await requireUser();
  let locations;
  try { locations = await recordUsage(user.id, kind, id); }
  catch { return <section className="usage-panel"><h2>Used in</h2><p role="status">Linked locations could not be loaded. Refresh to retry.</p></section>; }
  return <UsageLocations locations={locations} />;
}

export function UsageLocations({ locations }: { locations: Usage[] }) {
  return <section className="usage-panel"><div className="section-heading"><h2>Used in</h2><span className="record-meta">{locations.length} locations</span></div>
    <p className="panel-copy">Places this source is linked or used as a cover. Editing it updates the shared record.</p>
    {locations.length ? <ul className="usage-list">{locations.map(item => <li key={`${item.kind}:${item.id}`}><Link href={item.href}><span>{recordRoutes[item.kind].label}</span><strong>{item.title}</strong><span aria-hidden="true">↗</span></Link></li>)}</ul> : <p className="panel-copy">No linked locations yet.</p>}
  </section>;
}
