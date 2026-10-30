import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { kitFrom, kitParent, parseKitKind, type KitItem } from "@/lib/kit";
import { KitLibrary, type LibraryImage } from "@/components/kit-library";

export default async function KitPage({ searchParams }: { searchParams: Promise<{ new?: string; k?: string }> }) {
  const user = await requireUser(); const db = await createClient(); const params = await searchParams;
  const [{ data, error }, media] = await Promise.all([
    db.from("notes").select("id,title,plain_text,metadata,updated_at").eq("owner_id", user.id).eq("parent_type", kitParent).order("updated_at", { ascending: false }).limit(500),
    db.from("media").select("id,title,original_filename,caption").eq("owner_id", user.id).eq("media_type", "image").order("created_at", { ascending: false }).limit(400),
  ]);
  const items = (data || []).map(kitFrom).filter((item): item is KitItem => !!item);
  const images: LibraryImage[] = (media.data || []).map(row => ({ id: row.id as string, title: String(row.title || row.original_filename || "Untitled").replace(/\.(jpe?g|png|webp|gif|heic)$/i, ""), caption: String(row.caption || "") }));
  const startKind = parseKitKind(params.new) ?? undefined;
  return <div className="kit-page">
    <header className="page-header"><div><p className="eyebrow">Practice</p><h1 className="page-title">Application kit</h1><p className="page-description">Bios, statements, letters, budgets, and image sets you write once and reuse in every application.</p></div></header>
    {error && <p className="notice notice-error" role="alert">Your kit could not be loaded. Please retry.</p>}
    <KitLibrary key={`${params.new || ""}-${params.k || ""}`} items={items} images={images} startKind={startKind} openId={params.k} />
  </div>;
}
