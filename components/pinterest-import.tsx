"use client";
/* eslint-disable @next/next/no-img-element -- Pinterest's own board covers. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { disconnectPinterest, importBoard } from "@/app/(workspace)/library/pinterest/actions";

type Board = { id: string; name: string; description: string; pins: number | null; secret: boolean; cover: string };

export function PinterestImport({ username, boards, imported, loadError }: { username: string; boards: Board[]; imported: Record<string, string>; loadError: string }) {
  const router = useRouter();
  const [running, setRunning] = useState("");
  const [progress, setProgress] = useState<Record<string, string>>({});
  const stop = useRef(false);
  const say = (id: string, text: string) => setProgress(current => ({ ...current, [id]: text }));

  // Each round imports what fits in one server request; the loop carries on from Pinterest's bookmark until the board is done.
  async function run(list: Board[]) {
    stop.current = false;
    for (const board of list) {
      if (stop.current) break;
      setRunning(board.id);
      let bookmark = ""; let added = 0; let skipped = 0; let failed = 0;
      try {
        for (;;) {
          const result = await importBoard({ id: board.id, name: board.name, description: board.description }, bookmark);
          added += result.imported; skipped += result.skipped; failed += result.failed; bookmark = result.bookmark;
          say(board.id, `${added} added${skipped ? `, ${skipped} already here` : ""}${failed ? `, ${failed} couldn’t be saved` : ""}${result.done ? "." : "…"}`);
          if (result.done || stop.current) break;
        }
      } catch (problem) { say(board.id, problem instanceof Error ? problem.message : "Import failed. Please retry."); break; }
    }
    setRunning(""); router.refresh();
  }

  return <section className="pinterest" aria-label="Pinterest boards">
    <div className="pinterest-head"><p>Connected{username ? ` as ${username}` : ""}. {boards.length} {boards.length === 1 ? "board" : "boards"}.</p>
      <div className="pinterest-actions">
        {running ? <button type="button" className="button" onClick={() => { stop.current = true; }}>Stop after this round</button>
          : boards.length > 1 && <button type="button" className="button button-primary" onClick={() => void run(boards)}>Import all boards</button>}
        <button type="button" className="text-button" disabled={!!running} onClick={async () => { await disconnectPinterest(); router.refresh(); }}>Disconnect</button>
      </div></div>
    {loadError && <p className="notice notice-error" role="alert">{loadError}</p>}
    <p className="pinterest-note">Importing again later only adds new pins. After importing, use Describe in the Library to give the images titles and tags.</p>
    <ul className="pinterest-boards">{boards.map(board => <li key={board.id}>
      {board.cover ? <img src={board.cover} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="pinterest-cover" aria-hidden="true" />}
      <div><strong>{board.name}</strong>
        <small>{[board.pins != null ? `${board.pins} ${board.pins === 1 ? "pin" : "pins"}` : "", board.secret ? "secret" : "", imported[board.id] ? "imported before" : ""].filter(Boolean).join(" · ")}</small>
        {progress[board.id] && <small role="status">{running === board.id ? "Importing: " : ""}{progress[board.id]}</small>}
      </div>
      <div className="pinterest-actions">
        {imported[board.id] && <Link href={`/library?view=images&in=collection:${imported[board.id]}`}>View images</Link>}
        <button type="button" className="button" disabled={!!running} onClick={() => void run([board])}>{running === board.id ? "Importing…" : imported[board.id] ? "Import new pins" : "Import"}</button>
      </div>
    </li>)}</ul>
    {!boards.length && !loadError && <p className="pinterest-note">No boards found on this Pinterest account.</p>}
  </section>;
}
