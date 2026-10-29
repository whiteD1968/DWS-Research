"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkContact, logTouch, removeTouch, saveContact, setFollowUp, unlinkContact } from "@/app/(workspace)/contacts/actions";
import { searchEvidence } from "@/app/(workspace)/tenure/actions";
import { contactRoles, isQuiet, lastTouch, matchesContact, roleLabel, touchLabel, type Contact, type ContactRole } from "@/lib/contacts";
import { DeleteContent } from "@/components/content-controls";

export type ContactLink = { id: string; contactId: string; title: string; label: string; href: string };
type Panel = { mode: "new" } | { mode: "view"; id: string } | { mode: "edit"; id: string } | null;
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]!.toUpperCase()).join("");
const fmt = (day: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });

export function ContactBook({ contacts, links, today, openId, startNew = false }: { contacts: Contact[]; links: ContactLink[]; today: string; openId?: string; startNew?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<ContactRole | "all" | "quiet">("all");
  const [panel, setPanel] = useState<Panel>(startNew ? { mode: "new" } : openId && contacts.some(contact => contact.id === openId) ? { mode: "view", id: openId } : null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (panel) { if (!dialog.current?.open) dialog.current?.showModal(); } else dialog.current?.close(); }, [panel]);
  const current = panel && panel.mode !== "new" ? contacts.find(contact => contact.id === panel.id) : undefined;
  const quiet = contacts.filter(contact => isQuiet(contact, today)).length;
  const shown = contacts.filter(contact => matchesContact(contact, query) && (role === "all" || (role === "quiet" ? isQuiet(contact, today) : contact.role === role)));
  const roles = contactRoles.filter(option => contacts.some(contact => contact.role === option.key));

  return <>
    <div className="contacts-toolbar">
      <button type="button" className="button button-primary" onClick={() => setPanel({ mode: "new" })}>+ Add contact</button>
      {contacts.length > 0 && <input className="contacts-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${contacts.length} ${contacts.length === 1 ? "person" : "people"}`} aria-label="Search contacts" />}
      {contacts.length > 0 && <a className="text-button" href="/contacts/export" download>Export CSV</a>}
    </div>
    {contacts.length > 0 && <div className="cv-kinds contacts-filters" role="radiogroup" aria-label="Filter">
      <button type="button" role="radio" aria-checked={role === "all"} className={role === "all" ? "cv-kind cv-kind-on" : "cv-kind"} onClick={() => setRole("all")}>Everyone</button>
      {quiet > 0 && <button type="button" role="radio" aria-checked={role === "quiet"} className={role === "quiet" ? "cv-kind cv-kind-on" : "cv-kind"} onClick={() => setRole("quiet")}>Reach out · {quiet}</button>}
      {roles.map(option => <button key={option.key} type="button" role="radio" aria-checked={role === option.key} className={role === option.key ? "cv-kind cv-kind-on" : "cv-kind"} onClick={() => setRole(option.key)}>{option.label}</button>)}
    </div>}
    {!contacts.length && <div className="empty-state"><h2>Who&apos;s in your circle?</h2><p>Add the curators, jurors, gallerists, and collaborators you work with. Log each conversation and set a follow-up, and they&apos;ll show up in your reminders when it&apos;s time to reach out.</p></div>}
    {contacts.length > 0 && !shown.length && <p className="opp-empty">Nobody matches. Try another name or filter.</p>}
    <ul className="contacts-grid">{shown.map(contact => {
      const due = contact.followUp && contact.followUp <= today;
      return <li key={contact.id}><button type="button" className="contact-card" onClick={() => setPanel({ mode: "view", id: contact.id })}>
        <span className="contact-avatar" aria-hidden="true">{initials(contact.name)}</span>
        <span className="contact-card-body"><strong>{contact.name}</strong><span>{[roleLabel(contact.role), contact.organization].filter(Boolean).join(" · ")}</span>
          <small className={isQuiet(contact, today) ? "contact-quiet" : ""}>{touchLabel(lastTouch(contact), today)}{contact.city ? ` · ${contact.city}` : ""}</small></span>
        {contact.followUp && <span className={due ? "opp-pill opp-pill-soon" : "opp-pill"}>{due ? "Follow up" : `Follow up ${fmt(contact.followUp, { month: "short", day: "numeric" })}`}</span>}
      </button></li>;
    })}</ul>
    <dialog ref={dialog} className="content-dialog opp-dialog" aria-label="Contact" onClose={() => { setPanel(null); if (openId || startNew) router.replace("/contacts", { scroll: false }); }}>
      {panel?.mode === "new" && <ContactForm onDone={id => setPanel(id ? { mode: "view", id } : null)} />}
      {panel?.mode === "edit" && current && <ContactForm contact={current} onDone={() => setPanel({ mode: "view", id: current.id })} />}
      {panel?.mode === "view" && current && <ContactDetail key={current.id} contact={current} links={links.filter(link => link.contactId === current.id)} today={today} onEdit={() => setPanel({ mode: "edit", id: current.id })} onClose={() => setPanel(null)} />}
    </dialog>
  </>;
}

function ContactForm({ contact, onDone }: { contact?: Contact; onDone: (id?: string) => void }) {
  const router = useRouter();
  const [role, setRole] = useState<ContactRole>(contact?.role ?? "curator");
  const [error, setError] = useState(""); const [pending, start] = useTransition();
  return <form className="opp-form" onSubmit={event => {
    event.preventDefault(); const data = new FormData(event.currentTarget); data.set("role", role); if (contact) data.set("id", contact.id); setError("");
    start(async () => { try { const id = await saveContact(data); router.refresh(); onDone(id); } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save."); } });
  }}>
    <p className="eyebrow">{contact ? "Edit contact" : "New contact"}</p>
    <input className="cv-title" name="name" defaultValue={contact?.name} placeholder="Name" aria-label="Name" maxLength={200} autoFocus required />
    <div className="cv-kinds" role="radiogroup" aria-label="Role">{contactRoles.map(option => <button key={option.key} type="button" role="radio" aria-checked={role === option.key} className={role === option.key ? "cv-kind cv-kind-on" : "cv-kind"} onClick={() => setRole(option.key)}>{option.label}</button>)}</div>
    <div className="cv-row">
      <label className="field"><span>Organization</span><input name="organization" defaultValue={contact?.organization} maxLength={200} /></label>
      <label className="field"><span>City</span><input name="city" defaultValue={contact?.city} maxLength={120} /></label>
      <label className="field"><span>Email</span><input name="email" type="email" defaultValue={contact?.email} maxLength={200} /></label>
      <label className="field"><span>Phone</span><input name="phone" type="tel" defaultValue={contact?.phone} maxLength={60} /></label>
      <label className="field"><span>Website</span><input name="website" defaultValue={contact?.website} placeholder="example.com" maxLength={300} /></label>
      <label className="field"><span>Instagram</span><input name="instagram" defaultValue={contact?.instagram} placeholder="@handle" maxLength={60} /></label>
      <label className="field cv-wide"><span>How you met</span><input name="how_met" defaultValue={contact?.howMet} placeholder="Juried the 2025 national; met at NCECA" maxLength={300} /></label>
      {!contact && <label className="field cv-wide"><span>First touchpoint (optional)</span><input name="first_touch" placeholder="Met at the opening, talked about the spring show" maxLength={300} /></label>}
      <label className="field"><span>Follow up on</span><input name="follow_up" type="date" defaultValue={contact?.followUp} /></label>
      <label className="field cv-wide"><span>Notes</span><textarea name="notes" defaultValue={contact?.notes} rows={3} maxLength={20000} /></label>
    </div>
    <div className="cv-form-actions">{error && <p className="cv-error" role="alert">{error}</p>}<button type="button" className="button" onClick={() => onDone(contact?.id)} disabled={pending}>Cancel</button><button className="button button-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button></div>
  </form>;
}

const quickTouches = ["Email", "Call", "Studio visit", "Met at an opening", "Sent images"];

function ContactDetail({ contact, links, today, onEdit, onClose }: { contact: Contact; links: ContactLink[]; today: string; onEdit: () => void; onClose: () => void }) {
  const router = useRouter();
  const [day, setDay] = useState(today); const [text, setText] = useState("");
  const [query, setQuery] = useState(""); const [results, setResults] = useState<{ value: string; label: string; kind: string }[]>([]);
  const [error, setError] = useState(""); const [pending, start] = useTransition();
  useEffect(() => {
    const value = query.trim();
    const handle = setTimeout(async () => { try { setResults(value.length < 2 ? [] : await searchEvidence(value)); } catch { setResults([]); } }, 220);
    return () => clearTimeout(handle);
  }, [query]);
  const run = (task: () => Promise<unknown>, after?: () => void) => { setError(""); start(async () => { try { await task(); after?.(); router.refresh(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Something went wrong."); } }); };
  const handle = contact.instagram && `https://instagram.com/${encodeURIComponent(contact.instagram)}`;

  return <div className="opp-detail contact-detail">
    <div className="contact-detail-head"><span className="contact-avatar contact-avatar-large" aria-hidden="true">{initials(contact.name)}</span><div>
      <p className="eyebrow">{roleLabel(contact.role)}</p><h2>{contact.name}</h2>
      <p className="opp-detail-org">{[contact.organization, contact.city].filter(Boolean).join(" · ")}</p></div></div>
    <div className="contact-actions">
      {contact.email && <a className="cv-kind" href={`mailto:${contact.email}`}>Email</a>}
      {contact.phone && <a className="cv-kind" href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>Call</a>}
      {contact.website && <a className="cv-kind" href={contact.website} target="_blank" rel="noreferrer">Website ↗</a>}
      {handle && <a className="cv-kind" href={handle} target="_blank" rel="noreferrer">@{contact.instagram} ↗</a>}
    </div>
    <dl className="opp-facts">
      {contact.email && <div><dt>Email</dt><dd>{contact.email}</dd></div>}
      {contact.howMet && <div><dt>How you met</dt><dd>{contact.howMet}</dd></div>}
      <div><dt>Follow up</dt><dd><input className="contact-followup" type="date" defaultValue={contact.followUp} disabled={pending} onChange={event => { const value = event.target.value; run(() => setFollowUp(contact.id, value)); }} aria-label="Follow-up date" />{contact.followUp && <small> Shows in your reminders that morning</small>}</dd></div>
    </dl>
    {contact.notes && <p className="opp-notes">{contact.notes}</p>}

    <section className="contact-log" aria-label="Touchpoints">
      <h3>Touchpoints <span>{touchLabel(lastTouch(contact), today)}</span></h3>
      <form className="contact-log-add" onSubmit={event => { event.preventDefault(); run(() => logTouch(contact.id, day, text), () => setText("")); }}>
        <input type="date" value={day} max={today} onChange={event => setDay(event.target.value)} aria-label="Date" />
        <input value={text} onChange={event => setText(event.target.value)} placeholder="What happened?" aria-label="Touchpoint" maxLength={500} />
        <button className="button" disabled={pending || !text.trim()}>Log</button>
      </form>
      <div className="contact-quick">{quickTouches.map(label => <button key={label} type="button" className="cv-kind" onClick={() => setText(label)}>{label}</button>)}</div>
      {contact.log.length > 0 && <ul>{contact.log.map((touch, index) => <li key={`${touch.date}-${index}`}><span>{fmt(touch.date)}</span><p>{touch.text}</p><button type="button" aria-label="Remove touchpoint" onClick={() => run(() => removeTouch(contact.id, touch))}>×</button></li>)}</ul>}
    </section>

    <section className="contact-links" aria-label="Connected work">
      <h3>Connected to</h3>
      {links.length > 0 && <ul>{links.map(link => <li key={link.id}><Link href={link.href}><strong>{link.title}</strong><span>{link.label}</span></Link><button type="button" aria-label={`Disconnect ${link.title}`} onClick={() => run(() => unlinkContact(link.id))}>×</button></li>)}</ul>}
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Connect a project, opportunity, CV entry…" aria-label="Search for work to connect" />
      {query.trim().length >= 2 && <ul className="dossier-results">{results.length ? results.map(result => <li key={result.value}><button type="button" disabled={pending} onClick={() => run(() => linkContact(contact.id, result.value), () => { setQuery(""); setResults([]); })}><strong>{result.label}</strong><span>{result.kind}</span></button></li>) : <li className="dossier-results-empty">Nothing matches yet.</li>}</ul>}
    </section>

    <div className="opp-actions"><span className="opp-actions-spacer" /><button type="button" className="text-button" onClick={onEdit}>Edit</button><DeleteContent stayOnPage kind="note" id={contact.id} title={contact.name} /><button type="button" className="button" onClick={onClose}>Close</button></div>
    {error && <p className="cv-error" role="alert">{error}</p>}
  </div>;
}
