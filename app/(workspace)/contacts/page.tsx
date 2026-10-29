import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { studioToday } from "@/lib/journal";
import { recordRoutes, type RecordKind } from "@/lib/records";
import { evidenceKinds, evidenceLabels } from "@/lib/dossier";
import { contactFrom, contactLinkType, contactParent, sortContacts, type Contact } from "@/lib/contacts";
import { ContactBook, type ContactLink } from "@/components/contact-book";

const noteLabels: Record<string, string> = { opportunity: "Opportunity", cv: "CV entry", journal: "Journal entry", dossier: "Dossier" };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ c?: string; new?: string }> }) {
  const user = await requireUser(); const db = await createClient(); const params = await searchParams;
  const { data, error } = await db.from("notes").select("id,title,plain_text,metadata").eq("owner_id", user.id).eq("parent_type", contactParent).limit(5000);
  const contacts = (data || []).map(contactFrom).filter((contact): contact is Contact => !!contact).sort(sortContacts);
  const ids = contacts.map(contact => contact.id);
  const { data: rels } = ids.length ? await db.from("relationships").select("id,source_id,target_type,target_id").eq("owner_id", user.id).eq("source_type", "note").eq("relationship_type", contactLinkType).in("source_id", ids).limit(5000) : { data: [] };
  // One title lookup per kind keeps the page to a handful of queries however many links there are.
  const titles = new Map<string, { title: string; label: string }>();
  await Promise.all(evidenceKinds.map(async kind => {
    const wanted = [...new Set((rels || []).filter(rel => rel.target_type === kind).map(rel => rel.target_id as string))];
    if (!wanted.length) return;
    const { data: rows } = await db.from(recordRoutes[kind].table).select(kind === "note" ? "id,title,parent_type" : kind === "media" ? "id,title,original_filename" : "id,title").eq("owner_id", user.id).in("id", wanted);
    for (const row of (rows || []) as unknown as Record<string, unknown>[]) titles.set(`${kind}:${row.id}`, { title: String(row.title || row.original_filename || "Untitled"), label: kind === "note" ? noteLabels[String(row.parent_type)] ?? "Note" : evidenceLabels[kind] });
  }));
  const links: ContactLink[] = (rels || []).flatMap(rel => {
    const found = titles.get(`${rel.target_type}:${rel.target_id}`);
    if (!found) return [];
    const kind = rel.target_type as RecordKind;
    const href = kind === "note" && found.label === "Opportunity" ? "/opportunities" : kind === "note" && found.label === "CV entry" ? "/tenure/cv" : `${recordRoutes[kind].path}/${rel.target_id}`;
    return [{ id: rel.id as string, contactId: rel.source_id as string, title: found.title, label: found.label, href }];
  });
  return <div className="contacts-page">
    <header className="page-header"><div><p className="eyebrow">Practice</p><h1 className="page-title">Contacts</h1><p className="page-description">Curators, jurors, collaborators, and everyone else in the work, with when you last spoke and when to follow up.</p></div></header>
    {error && <p className="notice notice-error" role="alert">Contacts could not be loaded. Please retry.</p>}
    <ContactBook key={`${params.c || ""}${params.new || ""}`} contacts={contacts} links={links} today={studioToday()} openId={params.c} startNew={params.new === "1"} />
  </div>;
}
