"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { boardDestinations, handoffToBoard } from "@/app/(workspace)/boards/handoff-actions";
import { defaultBoardTitle, layouts, layoutLabels, type LayoutMode } from "@/lib/boards/layout";
import type { BoardHandoffSource } from "@/lib/boards/handoff";

export function BoardHandoff({ source, sourceTitle, selected, loadBoards = boardDestinations, send = handoffToBoard }: { source: BoardHandoffSource; sourceTitle: string; selected: string[]; loadBoards?: typeof boardDestinations; send?: typeof handoffToBoard }) {
  const router = useRouter();
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [boards, setBoards] = useState<{ id: string; title: string }[]>([]); const [destination, setDestination] = useState("");
  const [layout, setLayout] = useState<LayoutMode>("research_wall"); const [title, setTitle] = useState(defaultBoardTitle(sourceTitle, "research_wall"));
  const [edited, setEdited] = useState(false); const request = useRef({ fingerprint: "", id: "" });
  return <div className="board-handoff"><button type="button" className="button" disabled={busy || !selected.length || selected.length > 100} onClick={async () => { setBusy(true); setError(""); try { setBoards(await loadBoards()); request.current = { fingerprint: "", id: "" }; setOpen(true); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Send {selected.length || "selection"} to board</button>
    {error && <p role="alert">{error}</p>}
    {open && <form className="board-create" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try { const fingerprint = JSON.stringify({ source, selected, destination, title, layout }); if (request.current.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() }; const url = await send({ source, selected, boardId: destination || undefined, title, layout, requestId: request.current.id }); router.push(url); } catch (e) { setError((e as Error).message); setBusy(false); } }}>
      <h3>Send selection to a board</h3><p>{source.type === "discover" ? "Selected results are saved as linked library references first. Existing references are reused." : "Cards link to the original references in this collection."}</p>
      <label>Destination<select disabled={busy} value={destination} onChange={e => setDestination(e.target.value)}><option value="">Create a new board</option>{boards.map(board => <option key={board.id} value={board.id}>{board.title}</option>)}</select></label>
      {!destination && <><label>Title<input required maxLength={200} disabled={busy} value={title} onChange={e => { setTitle(e.target.value); setEdited(true); }} /></label><label>Layout<select disabled={busy} value={layout} onChange={e => { const next = e.target.value as LayoutMode; setLayout(next); if (!edited) setTitle(defaultBoardTitle(sourceTitle, next)); }}>{layouts.map(mode => <option key={mode} value={mode}>{layoutLabels[mode]}</option>)}</select></label></>}
      {destination && <p>The board opens with your selection placed beside its existing content.</p>}
      <div className="board-form-row"><button className="button button-primary" disabled={busy || !selected.length || selected.length > 100}>{busy ? "Preparing…" : destination ? "Add and open board" : "Create board"}</button><button type="button" className="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button></div>
    </form>}
  </div>;
}

export function CollectionBoardHandoff({ id, title, records }: { id: string; title: string; records: { id: string; title: string }[] }) {
  const [selected, setSelected] = useState<string[]>([]); const [query, setQuery] = useState("");
  return <details className="panel collection-board-handoff"><summary>Build a board from this collection</summary><p>Select up to 100 references.</p><input aria-label="Find collection references" placeholder="Find references" value={query} onChange={e => setQuery(e.target.value)} />
    <div className="board-form-row"><button type="button" className="text-button" onClick={() => setSelected(records.filter(r => r.title.toLowerCase().includes(query.toLowerCase())).slice(0, 100).map(r => r.id))}>Select shown (up to 100)</button><button type="button" className="text-button" onClick={() => setSelected([])}>Clear</button><span>{selected.length} selected</span></div>
    <div className="board-selection">{records.filter(r => r.title.toLowerCase().includes(query.toLowerCase())).map(r => <label key={r.id}><input type="checkbox" checked={selected.includes(r.id)} onChange={e => setSelected(e.target.checked ? [...selected, r.id] : selected.filter(id => id !== r.id))} />{r.title}</label>)}</div>
    <BoardHandoff source={{ type: "collection", id }} sourceTitle={title} selected={selected} />
  </details>;
}
