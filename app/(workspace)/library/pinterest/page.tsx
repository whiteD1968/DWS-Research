import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pinterestSettings } from "@/lib/pinterest-sync";
import { PinterestImport } from "@/components/pinterest-import";

export const maxDuration = 60;

export default async function PinterestPage() {
  const user = await requireUser(); const db = await createClient();
  const feeds = (await pinterestSettings(db, user.id))?.feeds || [];
  return <>
    <nav className="breadcrumb-row"><Link href="/library?view=images">Library / images</Link><span>/</span><span>Pinterest</span></nav>
    <header className="page-header"><div><p className="eyebrow">Import</p><h1 className="page-title">Pinterest</h1>
      <p className="page-description">Follow your public Pinterest boards and their newest pins come into the Library, each with a link back to the pin. Every board gets its own Collection, and new pins are picked up each morning.</p></div></header>
    <PinterestImport feeds={feeds.map(feed => ({ url: feed.url, label: feed.label, collectionId: feed.collectionId || "", lastSync: feed.lastSync || "", lastError: feed.lastError || "", imported: feed.imported || 0 }))} />
  </>;
}
