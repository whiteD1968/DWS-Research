"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMediaToProject, deleteMediaMany, tagMedia, untagMedia } from "@/app/actions/library";
import { describeSelectedImages } from "@/app/(workspace)/library/describe-actions";
import { DeleteContent, LibraryEditor } from "@/components/content-controls";
import { groupByMonth, type LibraryEntry, type LibraryLayout } from "@/lib/library";

export type GridEntry = LibraryEntry & { image: string | null };
type Option = { id: string; title: string };

export function LibraryGrid({ entries, layout, grouped = false, selectable, editable, describable = false, tags, projects }: { entries: GridEntry[]; layout: LibraryLayout; grouped?: boolean; selectable: boolean; editable: boolean; describable?: boolean; tags: Option[]; projects: Option[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState("");

  // Shift-click selects the whole run between the last click and this one, like a file browser.
  function toggle(index: number, shift: boolean) {
    const id = entries[index].id;
    if (shift && anchor !== null) {
      const [from, to] = anchor < index ? [anchor, index] : [index, anchor];
      const run = entries.slice(from, to + 1).map(entry => entry.id);
      setSelected(current => [...new Set([...current, ...run])]);
    } else setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
    setAnchor(index);
  }
  function run(task: () => Promise<unknown>, done: string | ((result: unknown) => string)) {
    setStatus("");
    start(async () => {
      try { const result = await task(); setStatus(typeof done === "string" ? done : done(result)); setSelected([]); router.refresh(); }
      catch (error) { setStatus(error instanceof Error ? error.message : "Something went wrong. Please retry."); }
    });
  }

  return <>
    {(grouped ? groupByMonth(entries) : [{ label: "", items: entries.map((entry, index) => ({ entry, index })) }]).map(group => <section key={group.label || "all"} className="library-group" aria-label={group.label || undefined}>
    {group.label && <h2 className="library-group-title">{group.label}<span>{group.items.length}</span></h2>}
    <div className={`library-grid library-layout-${layout}${selected.length ? " library-selecting" : ""}`}>{group.items.map(({ entry, index }) => {
      const isSelected = selected.includes(entry.id);
      return <article className={`library-card library-card-${entry.kind}${isSelected ? " library-card-selected" : ""}`} key={`${entry.kind}-${entry.id}`}>
        {selectable && <label className="library-select" onMouseDown={event => { if (event.shiftKey) event.preventDefault(); }} onClick={event => { event.preventDefault(); toggle(index, event.shiftKey); }}><input type="checkbox" checked={isSelected} readOnly aria-label={`Select ${entry.title}`} /></label>}
        {entry.image ? <Link href={entry.href} className="library-card-media"><img src={entry.image} alt={entry.altText} loading="lazy" referrerPolicy="no-referrer" /></Link> : layout === "compact" ? <Link href={entry.href} className="library-card-media library-card-placeholder"><span>{entry.label}</span></Link> : null}
        <div className="library-card-body"><p className="library-card-type">{entry.label}</p><h2><Link href={entry.href}>{entry.title}</Link></h2>
          {entry.text && <p className="library-card-text">{entry.text}</p>}
          {entry.tags.length > 0 && <ul className="library-card-tags" aria-label="Tags">{entry.tags.map(tag => <li key={tag.id}>{tag.name}</li>)}</ul>}
          {editable && layout === "grid" && entry.kind !== "references" && <><LibraryEditor kind={entry.kind === "notes" ? "note" : "media"} id={entry.id} title={entry.title} text={entry.text} altText={entry.altText} /><DeleteContent stayOnPage kind={entry.kind === "notes" ? "note" : "media"} id={entry.id} title={entry.title} /></>}
        </div>
      </article>;
    })}</div></section>)}

    {selectable && (selected.length > 0 || status) && <div className="library-batch" role="region" aria-label="Selected items">
      <p className="library-batch-count">{selected.length ? `${selected.length} selected` : status}</p>
      {selected.length > 0 && <>
        <form className="library-batch-field" onSubmit={event => { event.preventDefault(); const name = String(new FormData(event.currentTarget).get("tag") || ""); run(() => tagMedia(selected, name), `Tagged “${name.trim()}”.`); event.currentTarget.reset(); }}>
          <input name="tag" list="library-tag-names" placeholder="Add a tag" maxLength={60} required disabled={pending} aria-label="Tag name" />
          <datalist id="library-tag-names">{tags.map(tag => <option key={tag.id} value={tag.title} />)}</datalist>
          <button className="button" disabled={pending}>Tag</button>
        </form>
        {tags.length > 0 && <select className="library-batch-select" value="" disabled={pending} aria-label="Remove a tag" onChange={event => { const tag = tags.find(item => item.id === event.target.value); if (tag) run(() => untagMedia(selected, tag.id), `Removed “${tag.title}”.`); }}>
          <option value="">Remove tag…</option>{tags.map(tag => <option key={tag.id} value={tag.id}>{tag.title}</option>)}
        </select>}
        {projects.length > 0 && <select className="library-batch-select" value="" disabled={pending} aria-label="Add to a project" onChange={event => { const project = projects.find(item => item.id === event.target.value); if (project) run(() => addMediaToProject(selected, project.id), `Added to ${project.title}.`); }}>
          <option value="">Add to project…</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
        </select>}
        {describable && <button className="button" type="button" disabled={pending || selected.length > 30} title={selected.length > 30 ? "Select up to 30 images" : "Write a caption, alt text, and tags with Claude"} onClick={() => { run(() => describeSelectedImages(selected), result => { const r = result as { described: number; failed: number; stopped: string }; return r.stopped || `Described ${r.described} ${r.described === 1 ? "image" : "images"}.${r.failed ? ` ${r.failed} couldn’t be read.` : ""}`; }); }}>Describe with AI</button>}
        <button className="button button-danger-quiet" type="button" disabled={pending} onClick={() => { setConfirmation(""); setStatus(""); dialog.current?.showModal(); }}>Delete</button>
        <button className="text-button" type="button" disabled={pending} onClick={() => setSelected(entries.map(entry => entry.id))}>Select page</button>
        <button className="text-button" type="button" disabled={pending} onClick={() => { setSelected([]); setStatus(""); }}>Clear</button>
        {status && <p className="library-batch-status" role="status">{status}</p>}
      </>}
    </div>}

    <dialog ref={dialog} className="content-dialog" aria-label="Delete selected items" onCancel={event => { if (pending) event.preventDefault(); }}>
      <form className="form-stack" onSubmit={event => { event.preventDefault(); const ids = selected; dialog.current?.close(); run(() => deleteMediaMany(ids, confirmation), `Deleted ${ids.length} ${ids.length === 1 ? "item" : "items"}.`); }}>
        <p className="eyebrow">Delete {selected.length} {selected.length === 1 ? "item" : "items"}</p>
        <p>This permanently deletes the selected files and removes them from every project, topic, and board. Board cards for them will show “Source removed”.</p>
        <label className="field"><span>Type DELETE to confirm</span><input autoFocus value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" /></label>
        <div className="inline-actions"><button className="button" type="button" onClick={() => dialog.current?.close()}>Cancel</button><button className="button button-danger" disabled={confirmation !== "DELETE"}>Permanently delete</button></div>
      </form>
    </dialog>
  </>;
}
