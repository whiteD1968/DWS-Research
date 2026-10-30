"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cvCitation, cvYears, groupCv } from "@/lib/cv";
import { CvEntryForm, type CvEntry } from "@/components/cv-entry-form";
import { DeleteContent } from "@/components/content-controls";

type Row = CvEntry & { files: number };

export function CvList({ entries, startOpen = false }: { entries: Row[]; startOpen?: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<CvEntry | "new" | null>(startOpen ? "new" : null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (editing) dialog.current?.showModal(); else dialog.current?.close(); }, [editing]);
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const exportHref = `/tenure/cv/export${selected.length ? `?ids=${selected.join(",")}` : ""}`;

  return <>
    <div className="cv-toolbar">
      <button type="button" className="button button-primary" onClick={() => setEditing("new")}>+ Log accomplishment</button>
      {entries.length > 0 && <>
        <span className="cv-toolbar-count">{selected.length ? `${selected.length} selected` : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}</span>
        {selected.length > 0 && <button type="button" className="text-button" onClick={() => setSelected([])}>Clear</button>}
        <a className="button" href={exportHref} download>{selected.length ? "Export selected (.docx)" : "Export all (.docx)"}</a>
      </>}
    </div>
    {!entries.length && <div className="empty-state"><h2>Your CV starts here</h2><p>Each time you finish a show, a publication, a talk, or a residency, log it in a few seconds. When you need the CV, export everything to Word and place it into your InDesign template.</p></div>}
    {groupCv(entries).map(group => <section key={group.category.key} className="cv-group">
      <h2 className="cv-group-title">{group.category.label}<button type="button" className="text-button" onClick={() => { const ids = group.entries.map(entry => entry.id); setSelected(current => ids.every(id => current.includes(id)) ? current.filter(id => !ids.includes(id)) : [...new Set([...current, ...ids])]); }}>Select section</button></h2>
      <ul>{group.entries.map(entry => <li key={entry.id} className={selected.includes(entry.id) ? "cv-line cv-line-selected" : "cv-line"}>
        <input type="checkbox" checked={selected.includes(entry.id)} onChange={() => toggle(entry.id)} aria-label={`Select ${entry.title}`} />
        <span className="cv-line-year">{cvYears(entry)}</span>
        <p className="cv-line-text">{cvCitation(entry)}{entry.url && <> <a href={entry.url} target="_blank" rel="noreferrer">Link ↗</a></>}</p>
        <span className="cv-line-actions">
          {entry.files > 0 && <Link className="cv-line-files" href={`/library/items/note/${entry.id}`}>{entry.files} {entry.files === 1 ? "file" : "files"}</Link>}
          <button type="button" className="text-button" onClick={() => setEditing(entry)}>Edit</button>
          <DeleteContent stayOnPage kind="note" id={entry.id} title={entry.title} />
        </span>
      </li>)}</ul>
    </section>)}
    <dialog ref={dialog} className="content-dialog cv-dialog" aria-label={editing === "new" ? "Log accomplishment" : "Edit entry"} onClose={() => { setEditing(null); if (startOpen) router.replace("/tenure/cv", { scroll: false }); }}>
      {editing && <><p className="eyebrow">{editing === "new" ? "Log accomplishment" : "Edit entry"}</p><CvEntryForm key={editing === "new" ? "new" : editing.id} entry={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} /></>}
    </dialog>
  </>;
}
