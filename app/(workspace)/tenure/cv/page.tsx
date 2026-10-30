import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cvFields, cvParent } from "@/lib/cv";
import { CvList } from "@/components/cv-list";
import { cvStyleNames } from "@/lib/cv-docx";

export default async function CvPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const user = await requireUser(); const db = await createClient(); const params = await searchParams;
  const { data: rows, error } = await db.from("notes").select("id,title,plain_text,metadata").eq("owner_id", user.id).eq("parent_type", cvParent).limit(2000);
  const ids = (rows || []).map(row => row.id as string);
  const { data: files } = ids.length ? await db.from("relationships").select("source_id").eq("owner_id", user.id).eq("source_type", "note").in("relationship_type", ["has_media", "has_document"]).in("source_id", ids) : { data: [] };
  const entries = (rows || []).flatMap(row => { const fields = cvFields(row); return fields ? [{ ...fields, id: row.id as string, notes: row.plain_text || "", files: (files || []).filter(file => file.source_id === row.id).length }] : []; });
  return <div className="cv-page">
    <header className="page-header"><div><p className="eyebrow">Tenure &amp; promotion</p><h1 className="page-title">CV</h1><p className="page-description">Log each accomplishment as it happens. Export to Word, then place it in InDesign with “Show Import Options” and map the styles <strong>{cvStyleNames.heading}</strong>, <strong>{cvStyleNames.entry}</strong> and <strong>{cvStyleNames.link}</strong> to your template’s styles.</p></div></header>
    {error && <p className="notice notice-error" role="alert">Your CV entries could not be loaded. Please retry.</p>}
    <CvList key={params.new === "1" ? "new" : "list"} entries={entries} startOpen={params.new === "1"} />
  </div>;
}
