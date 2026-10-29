import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { recordRoutes } from "@/lib/records";
import { thumbnailUrl } from "@/lib/thumbnails";
import { studioToday } from "@/lib/journal";
import { daysUntil, dossierParent, dossierSections, dossierSettingsParent, evidenceKinds, evidenceLabels, evidenceType, parseReviewDate, type EvidenceKind } from "@/lib/dossier";
import { DossierView, type DossierItem } from "@/components/dossier-view";

export default async function TenurePage() {
  const user = await requireUser(); const db = await createClient();
  const [statements, settings] = await Promise.all([
    db.from("notes").select("id,plain_text,metadata,updated_at").eq("owner_id", user.id).eq("parent_type", dossierParent).order("created_at"),
    db.from("notes").select("metadata").eq("owner_id", user.id).eq("parent_type", dossierSettingsParent).limit(1).maybeSingle(),
  ]);
  const sectionNotes = new Map<string, { id: string; text: string; updatedAt: string }>();
  for (const row of statements.data || []) {
    const key = String((row.metadata as { section?: unknown })?.section || "");
    if (!sectionNotes.has(key)) sectionNotes.set(key, { id: row.id, text: row.plain_text || "", updatedAt: row.updated_at });
  }
  const ids = [...sectionNotes.values()].map(note => note.id);
  const { data: links } = ids.length ? await db.from("relationships").select("id,source_id,target_type,target_id,created_at").eq("owner_id", user.id).eq("source_type", "note").eq("relationship_type", evidenceType).in("source_id", ids).order("created_at") : { data: [] };

  // One title lookup per kind of record, so a large dossier still loads in a handful of queries.
  const details = new Map<string, { title: string; detail: string; image: string | null }>();
  await Promise.all(evidenceKinds.map(async kind => {
    const wanted = [...new Set((links || []).filter(link => link.target_type === kind).map(link => link.target_id as string))];
    if (!wanted.length) return;
    const columns = kind === "media" ? "id,title,original_filename,media_type" : kind === "note" ? "id,title,plain_text,parent_type,metadata" : kind === "reference" ? "id,title,creator,reference_type" : "id,title";
    const { data } = await db.from(recordRoutes[kind].table).select(columns).eq("owner_id", user.id).in("id", wanted);
    for (const row of (data || []) as unknown as Record<string, unknown>[]) {
      const id = String(row.id);
      const title = String(row.title || row.original_filename || (kind === "note" ? String(row.plain_text || "").slice(0, 90) : "") || "Untitled");
      const detail = kind === "note" && row.parent_type === "journal" ? `Journal · ${String((row.metadata as { entry_date?: string })?.entry_date || "")}` : kind === "reference" && row.creator ? `Reference · ${row.creator}` : kind === "media" ? (row.media_type === "image" ? "Image" : "Document") : evidenceLabels[kind];
      details.set(`${kind}:${id}`, { title, detail, image: kind === "media" && row.media_type === "image" ? thumbnailUrl(id) : null });
    }
  }));
  const itemsFor = (sectionId?: string): DossierItem[] => sectionId ? (links || []).filter(link => link.source_id === sectionId).flatMap(link => {
    const found = details.get(`${link.target_type}:${link.target_id}`);
    return found ? [{ link: link.id as string, kind: link.target_type as EvidenceKind, id: link.target_id as string, ...found }] : [];
  }) : [];

  const reviewDate = parseReviewDate((settings.data?.metadata as { review_date?: unknown })?.review_date) || "";
  const today = studioToday();
  const days = reviewDate ? daysUntil(reviewDate, today) : null;
  const sections = dossierSections.map(section => { const note = sectionNotes.get(section.key); return { ...section, text: note?.text || "", items: itemsFor(note?.id) }; });

  return <DossierView reviewDate={reviewDate} days={days} sections={sections} />;
}
