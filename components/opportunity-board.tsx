"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkOpportunityCv, saveOpportunity, setOpportunityMaterials, setOpportunityStatus } from "@/app/(workspace)/opportunities/actions";
import { deadlineLabel, deadlineTone, opportunityKind, opportunityKinds, opportunityStages, stageOf, statusLabels, type Material, type Opportunity, type OpportunityStatus } from "@/lib/opportunities";
import { CvEntryForm } from "@/components/cv-entry-form";
import { DeleteContent } from "@/components/content-controls";

type Panel = { mode: "new" } | { mode: "view"; id: string } | { mode: "edit"; id: string } | { mode: "cv"; id: string } | null;

export function OpportunityBoard({ items, today, startOpen = false, openId }: { items: Opportunity[]; today: string; startOpen?: boolean; openId?: string }) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(startOpen ? { mode: "new" } : openId && items.some(item => item.id === openId) ? { mode: "view", id: openId } : null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (panel) { if (!dialog.current?.open) dialog.current?.showModal(); } else dialog.current?.close(); }, [panel]);
  const current = panel && panel.mode !== "new" ? items.find(item => item.id === panel.id) : undefined;

  return <>
    <div className="opp-toolbar"><button type="button" className="button button-primary" onClick={() => setPanel({ mode: "new" })}>+ Add opportunity</button></div>
    <div className="opp-board">{opportunityStages.map(stage => {
      const column = items.filter(item => stageOf(item.status) === stage.key);
      return <section key={stage.key} className={`opp-column opp-column-${stage.key}`} aria-label={stage.label}>
        <h2>{stage.label}<span>{column.length}</span></h2>
        {column.length ? column.map(item => {
          const ready = item.materials.filter(material => material.done).length;
          return <button key={item.id} type="button" className={`opp-card opp-card-${item.status}`} onClick={() => setPanel({ mode: "view", id: item.id })}>
            <span className="opp-card-kind">{opportunityKind(item.kind).label}</span>
            <strong>{item.title}</strong>
            {item.organization && <span className="opp-card-org">{item.organization}</span>}
            <span className="opp-card-meta">
              {stage.key === "decided" ? <span className={`opp-pill opp-pill-${item.status}`}>{item.status === "accepted" ? "Accepted ✦" : statusLabels[item.status]}</span> : <span className={`opp-pill opp-pill-${deadlineTone(item.deadline, today, item.status)}`}>{deadlineLabel(item.deadline, today)}</span>}
              {stage.key !== "decided" && item.materials.length > 0 && <span className="opp-progress" aria-label={`${ready} of ${item.materials.length} materials ready`}><span style={{ width: `${(ready / item.materials.length) * 100}%` }} />{ready}/{item.materials.length}</span>}
            </span>
          </button>;
        }) : <p className="opp-empty">{stage.key === "interested" ? "Calls and grants you might apply for." : stage.key === "preparing" ? "Move things here once you start the application." : stage.key === "submitted" ? "Waiting to hear back." : "Results land here."}</p>}
      </section>;
    })}</div>
    <dialog ref={dialog} className="content-dialog opp-dialog" aria-label="Opportunity" onClose={() => { setPanel(null); if (startOpen || openId) router.replace("/opportunities", { scroll: false }); }}>
      {panel?.mode === "new" && <OpportunityForm onDone={() => setPanel(null)} />}
      {panel?.mode === "edit" && current && <OpportunityForm item={current} onDone={() => setPanel({ mode: "view", id: current.id })} />}
      {panel?.mode === "view" && current && <OpportunityDetail item={current} today={today} onEdit={() => setPanel({ mode: "edit", id: current.id })} onLogCv={() => setPanel({ mode: "cv", id: current.id })} onClose={() => setPanel(null)} />}
      {panel?.mode === "cv" && current && <><p className="eyebrow">Log to CV</p><CvEntryForm prefill={{ category: opportunityKind(current.kind).cv, title: current.title, venue: current.organization, location: current.location, date: today.slice(0, 4), url: current.url }} onDone={async id => { if (id) { try { await linkOpportunityCv(current.id, id); router.refresh(); } catch { /* the CV entry is saved either way */ } } setPanel({ mode: "view", id: current.id }); }} /></>}
    </dialog>
  </>;
}

function OpportunityForm({ item, onDone }: { item?: Opportunity; onDone: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState(item?.kind ?? "exhibition");
  const [error, setError] = useState(""); const [pending, start] = useTransition();
  return <form className="opp-form" onSubmit={event => {
    event.preventDefault(); const data = new FormData(event.currentTarget); data.set("kind", kind); if (item) data.set("id", item.id); setError("");
    start(async () => { try { await saveOpportunity(data); router.refresh(); onDone(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save."); } });
  }}>
    <p className="eyebrow">{item ? "Edit opportunity" : "New opportunity"}</p>
    <div className="cv-kinds" role="radiogroup" aria-label="Kind">{opportunityKinds.map(option => <button key={option.key} type="button" role="radio" aria-checked={kind === option.key} className={kind === option.key ? "cv-kind cv-kind-on" : "cv-kind"} onClick={() => setKind(option.key)}>{option.label}</button>)}</div>
    <input className="cv-title" name="title" defaultValue={item?.title} placeholder="Name of the call, grant, or residency" aria-label="Name" maxLength={300} autoFocus required />
    <div className="cv-row">
      <label className="field"><span>Organization</span><input name="organization" defaultValue={item?.organization} maxLength={300} /></label>
      <label className="field"><span>Deadline</span><input name="deadline" type="date" defaultValue={item?.deadline} /></label>
      <label className="field"><span>Where</span><input name="location" defaultValue={item?.location} maxLength={200} /></label>
      <label className="field"><span>Link to the call</span><input name="url" type="url" defaultValue={item?.url} placeholder="https://" maxLength={500} /></label>
      <label className="field"><span>Fee</span><input name="fee" defaultValue={item?.fee} placeholder="$35" maxLength={40} /></label>
      <label className="field"><span>Award or stipend</span><input name="award" defaultValue={item?.award} placeholder="$5,000" maxLength={80} /></label>
      <label className="field cv-wide"><span>Notes</span><textarea name="notes" defaultValue={item?.notes} rows={3} maxLength={20000} placeholder="Eligibility, juror, what they're looking for…" /></label>
    </div>
    {!item && <p className="opp-hint">You’ll get a reminder on Home a week before the deadline, and a checklist of the usual materials for this kind of application.</p>}
    <div className="cv-form-actions">{error && <p className="cv-error" role="alert">{error}</p>}<button type="button" className="button" onClick={onDone} disabled={pending}>Cancel</button><button className="button button-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button></div>
  </form>;
}

const nextSteps: Partial<Record<OpportunityStatus, { status: OpportunityStatus; label: string }[]>> = {
  interested: [{ status: "preparing", label: "Start preparing" }],
  preparing: [{ status: "submitted", label: "Mark submitted" }, { status: "interested", label: "Back to interested" }],
  submitted: [{ status: "accepted", label: "Accepted" }, { status: "declined", label: "Not selected" }],
};

function OpportunityDetail({ item, today, onEdit, onLogCv, onClose }: { item: Opportunity; today: string; onEdit: () => void; onLogCv: () => void; onClose: () => void }) {
  const router = useRouter();
  const [materials, setMaterials] = useState<Material[]>(item.materials);
  const [adding, setAdding] = useState("");
  const [error, setError] = useState(""); const [pending, start] = useTransition();
  const [celebrate, setCelebrate] = useState(false);
  function saveList(next: Material[]) { setMaterials(next); start(async () => { try { await setOpportunityMaterials(item.id, next); router.refresh(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save."); } }); }
  function move(status: OpportunityStatus) { setError(""); start(async () => { try { await setOpportunityStatus(item.id, status); if (status === "accepted") setCelebrate(true); router.refresh(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not update."); } }); }
  const ready = materials.filter(material => material.done).length;
  const decided = stageOf(item.status) === "decided";

  return <div className="opp-detail">
    <p className="eyebrow">{opportunityKind(item.kind).label} · {statusLabels[item.status]}</p>
    <h2>{item.title}</h2>
    <p className="opp-detail-org">{[item.organization, item.location].filter(Boolean).join(" · ")}</p>
    <dl className="opp-facts">
      <div><dt>Deadline</dt><dd className={`opp-tone-${deadlineTone(item.deadline, today, item.status)}`}>{item.deadline ? `${new Date(`${item.deadline}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}${deadlineTone(item.deadline, today, item.status) === "soon" ? ` · ${deadlineLabel(item.deadline, today)}` : ""}` : "None set"}</dd></div>
      {item.fee && <div><dt>Fee</dt><dd>{item.fee}</dd></div>}
      {item.award && <div><dt>Award</dt><dd>{item.award}</dd></div>}
      {item.url && <div><dt>Call</dt><dd><a href={item.url} target="_blank" rel="noreferrer">Open the call ↗</a></dd></div>}
    </dl>
    {item.notes && <p className="opp-notes">{item.notes}</p>}

    {celebrate || (item.status === "accepted" && !item.cvEntryId) ? <div className="opp-accepted"><strong>{celebrate ? "Congratulations." : "Accepted."}</strong> Add it to your CV while the details are fresh.<button type="button" className="button button-primary" onClick={onLogCv}>Log to CV</button></div> : item.cvEntryId ? <p className="opp-logged">✓ On your CV</p> : null}

    {!decided && <section className="opp-materials" aria-label="Materials">
      <h3>Materials <span>{ready}/{materials.length}</span></h3>
      <ul>{materials.map((material, index) => <li key={`${material.label}-${index}`} className={material.done ? "opp-material-done" : ""}>
        <label><input type="checkbox" checked={material.done} onChange={() => saveList(materials.map((entry, i) => i === index ? { ...entry, done: !entry.done } : entry))} /> {material.label}</label>
        <button type="button" aria-label={`Remove ${material.label}`} onClick={() => saveList(materials.filter((_, i) => i !== index))}>×</button>
      </li>)}</ul>
      <form className="opp-material-add" onSubmit={event => { event.preventDefault(); if (adding.trim()) { saveList([...materials, { label: adding.trim(), done: false }]); setAdding(""); } }}><input value={adding} onChange={event => setAdding(event.target.value)} placeholder="Add an item" aria-label="Add a material" maxLength={120} /></form>
    </section>}

    <div className="opp-actions">
      {(nextSteps[item.status] || []).map(step => <button key={step.status} type="button" className={step.status === "accepted" || step.status === "preparing" || step.status === "submitted" ? "button button-primary" : "button"} disabled={pending} onClick={() => move(step.status)}>{step.label}</button>)}
      {decided && <button type="button" className="button" disabled={pending} onClick={() => move("submitted")}>Reopen</button>}
      {!decided && item.status !== "submitted" && <button type="button" className="text-button" disabled={pending} onClick={() => move("withdrawn")}>Not applying</button>}
      <span className="opp-actions-spacer" />
      <button type="button" className="text-button" onClick={onEdit}>Edit</button>
      <DeleteContent stayOnPage kind="note" id={item.id} title={item.title} />
      <button type="button" className="button" onClick={onClose}>Close</button>
    </div>
    {error && <p className="cv-error" role="alert">{error}</p>}
  </div>;
}
