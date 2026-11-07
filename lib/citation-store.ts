import type { SupabaseClient } from "@supabase/supabase-js";
import { citationFromReference, storedCitation } from "@/lib/citation";

type Row = { id: string; title: string; reference_type: string | null; creator: string | null; reference_date: string | null; location: string | null;
  metadata: Record<string, unknown> | null; created_at: string; sources: { url: string | null; publication: string | null; doi: string | null } | null };

// Writes a generated APA citation into references.metadata.apa_citation. A citation the owner
// edited by hand is left alone. Failures are reported, never thrown: the save itself already succeeded.
export async function storeCitations(db: SupabaseClient, ownerId: string, referenceIds: string[]) {
  try { return await writeCitations(db, ownerId, referenceIds); } catch { return { stored: 0, error: "Citations could not be generated." }; }
}

async function writeCitations(db: SupabaseClient, ownerId: string, referenceIds: string[]) {
  const ids = [...new Set(referenceIds.filter(Boolean))].slice(0, 500);
  if (!ids.length) return { stored: 0 };
  const { data, error } = await db.from("references").select("id,title,reference_type,creator,reference_date,location,metadata,created_at,sources:primary_source_id(url,publication,doi)")
    .eq("owner_id", ownerId).in("id", ids);
  if (error || !data) return { stored: 0, error: "Citations could not be generated." };
  let stored = 0;
  for (const row of data as unknown as Row[]) {
    const metadata = row.metadata ?? {};
    if ((metadata.apa_citation as { edited?: boolean } | undefined)?.edited) continue;
    const apa_citation = storedCitation(citationFromReference(row, row.sources));
    const { error: writeError } = await db.from("references").update({ metadata: { ...metadata, apa_citation } }).eq("owner_id", ownerId).eq("id", row.id);
    if (!writeError) stored += 1;
  }
  return { stored };
}
