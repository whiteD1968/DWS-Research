"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated, server-resized thumbnail endpoint. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createGeneratedBoard } from "@/app/(workspace)/boards/actions";
import { defaultBoardTitle, layoutLabels, layouts, type BoardRecord, type LayoutMode } from "@/lib/boards/layout";

export function BoardCreator({ topicId, topicTitle, records }: { topicId: string; topicTitle: string; records: BoardRecord[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [title, setTitle] = useState(defaultBoardTitle(topicTitle, "research_wall"));
  const [titleEdited, setTitleEdited] = useState(false);
  const [layout, setLayout] = useState<LayoutMode>("research_wall");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!open) return <button className="button button-primary" onClick={() => setOpen(true)}>+ Create Research Board</button>;
  return <form className="board-create" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError("");
    try { const id = await createGeneratedBoard({ sourceId: topicId, recordSelection: selected, layoutMode: layout, title, manual }); router.push(`/boards/${id}`); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to create board."); setBusy(false); }
  }}>
    <div className="board-form-row"><label>Title<input value={title} onChange={e => { setTitle(e.target.value); setTitleEdited(true); }} required maxLength={200} /></label><label>Composition<select value={manual ? "manual" : "generated"} onChange={e => { const nextManual = e.target.value === "manual"; setManual(nextManual); if (!titleEdited) setTitle(defaultBoardTitle(topicTitle, nextManual ? "manual" : layout)); }}><option value="generated">Generated board</option><option value="manual">Manual board</option></select></label></div>
    {!manual && <><label>Layout<select value={layout} onChange={e => { const nextLayout = e.target.value as LayoutMode; setLayout(nextLayout); if (!titleEdited) setTitle(defaultBoardTitle(topicTitle, nextLayout)); }}>{layouts.map(l => <option value={l} key={l}>{layoutLabels[l]}</option>)}</select></label>
      <div className="board-form-row"><button type="button" className="button" onClick={() => setSelected(records.map(r => r.key))}>Select all</button><button type="button" className="button" onClick={() => setSelected([])}>Clear</button>
        <select aria-label="Select by type" value="" onChange={e => setSelected(records.filter(r => r.type === e.target.value).map(r => r.key))}><option value="">Select by type</option>{[...new Set(records.map(r => r.type))].map(t => <option key={t}>{t}</option>)}</select>
        <select aria-label="Select by theme" value="" onChange={e => setSelected(records.filter(r => r.id === e.target.value || r.themeIds.includes(e.target.value)).map(r => r.key))}><option value="">Select by theme</option>{records.filter(r => r.type === "theme").map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select><span>{selected.length} selected</span></div>
      <div className="board-selection">{records.map(r => <label key={r.key}><input type="checkbox" checked={selected.includes(r.key)} onChange={e => setSelected(e.target.checked ? [...selected, r.key] : selected.filter(k => k !== r.key))} />{r.image && <img src={r.image} alt="" loading="lazy" />}<span><small>{r.type}</small>{r.title}</span></label>)}</div></>}
    {error && <p role="alert">{error}</p>}<div className="board-form-row"><button className="button button-primary" disabled={busy || (!manual && (!selected.length || selected.length > 100))}>{busy ? "Creating..." : manual ? "Create empty board" : "Generate board"}</button><button type="button" className="button" onClick={() => setOpen(false)}>Cancel</button></div>
  </form>;
}
