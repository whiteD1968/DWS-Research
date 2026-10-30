import type { createClient } from "@/lib/supabase/server";
import { dossierParent, evidenceType, sectionLabel, type DossierSection } from "@/lib/dossier";

type Db = Awaited<ReturnType<typeof createClient>>;

// Each section's statement note is made the first time it is needed, so an empty dossier costs nothing.
export async function sectionNoteId(db: Db, ownerId: string, section: DossierSection) {
  const { data: found } = await db.from("notes").select("id").eq("owner_id", ownerId).eq("parent_type", dossierParent).eq("metadata->>section", section).order("created_at").limit(1).maybeSingle();
  if (found) return found.id as string;
  const { data, error } = await db.from("notes").insert({ owner_id: ownerId, title: `${sectionLabel(section)} statement`, parent_type: dossierParent, plain_text: "", content: [], metadata: { section } }).select("id").single();
  if (error || !data) throw new Error("Could not open that dossier section. Please retry.");
  return data.id as string;
}

export function evidenceRow(ownerId: string, sectionId: string, kind: string, id: string) {
  return { owner_id: ownerId, source_type: "note", source_id: sectionId, relationship_type: evidenceType, target_type: kind, target_id: id, metadata: {} };
}
