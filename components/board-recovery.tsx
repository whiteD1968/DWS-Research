"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ResearchBoardCanvas, type BoardCanvasProps } from "./research-board-canvas";
import { draftMatchesServer, listDrafts, removeDraft, type BoardDraft } from "@/lib/boards/drafts";
import { copyRecoveredBoard } from "@/app/(workspace)/boards/recovery-actions";

export function BoardRecovery(props: BoardCanvasProps & { persist?: Parameters<typeof ResearchBoardCanvas>[0]["persist"] }) {
  const [drafts, setDrafts] = useState<BoardDraft[] | null>(null);
  const [choice, setChoice] = useState<{ draft?: BoardDraft } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const copyIds = useRef(new Map<string, string>());
  const router = useRouter();
  useEffect(() => {
    let active = true;
    listDrafts(props.ownerId, props.board.id).then(async rows => {
      const remaining = [];
      for (const draft of rows) { if (draftMatchesServer(draft, props.board.snapshot)) await removeDraft(draft); else remaining.push(draft); }
      if (active) { setDrafts(remaining); if (!remaining.length) setChoice({}); }
    }).catch(() => { if (active) { setError("Local recovery storage is unavailable. Keep this tab open until changes are saved."); setChoice({}); } });
    return () => { active = false; };
  }, [props.ownerId, props.board.id, props.board.snapshot]);
  if (choice) return <ResearchBoardCanvas {...props} recoveryDraft={choice.draft} recoveryWarning={error} />;
  if (!drafts) return <p role="status">Checking for recoverable work…</p>;
  return <section className="board-recovery panel"><h1>Recover unsaved board work</h1><p>Drafts are stored in this browser. Another open tab may still be editing one. Choose a draft or open the saved board; drafts are retained until you discard them or successfully save recovered work.</p>
    {error && <p role="alert">{error}</p>}
    {drafts.map(draft => <article key={draft.id}><h2>Draft from {new Date(draft.savedAt).toLocaleString()}</h2><p>{draft.revision === props.board.updated_at ? "Based on the current saved version." : "The saved board has changed. Save this draft as a separate board to preserve both versions."}</p>
      <div className="board-form-row">{draft.revision === props.board.updated_at && <button className="button" disabled={busy} onClick={() => setChoice({ draft })}>Restore draft</button>}
      <button className="button" disabled={busy} onClick={async () => { setBusy(true); try { const copyId = copyIds.current.get(draft.id) || crypto.randomUUID(); copyIds.current.set(draft.id, copyId); const id = await copyRecoveredBoard(props.board.id, copyId, draft.snapshot); await removeDraft(draft); router.push(`/boards/${id}`); } catch (e) { setError((e as Error).message); setBusy(false); } }}>Save as separate board</button>
      <button className="text-button" disabled={busy} onClick={async () => { if (!window.confirm("Discard this local draft? The saved board will remain unchanged.")) return; try { await removeDraft(draft); setDrafts(drafts.filter(d => d.id !== draft.id)); } catch { setError("Draft could not be removed."); } }}>Discard draft</button></div>
    </article>)}<button className="button" disabled={busy} onClick={() => setChoice({})}>Open saved board</button></section>;
}
