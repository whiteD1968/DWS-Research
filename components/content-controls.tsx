"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteContent, editLibraryContent } from "@/app/actions/content";
import { contentKinds, type ContentKind } from "@/lib/content";

export function DeleteContent({ kind, id, title, stayOnPage = false }: { kind: ContentKind; id: string; title: string; stayOnPage?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return <><button type="button" className="button button-danger-quiet" onClick={() => { setError(""); setConfirmation(""); dialog.current?.showModal(); }}>Delete {contentKinds[kind].label}</button>
    <dialog ref={dialog} className="content-dialog" aria-label={`Delete ${title}`} onCancel={e => { if (pending) e.preventDefault(); }}>
      <form className="form-stack" onSubmit={e => { e.preventDefault(); start(async () => { try { const destination = await deleteContent(kind, id, confirmation); dialog.current?.close(); if (!stayOnPage) router.push(destination); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Deletion failed."); } }); }}>
        <p className="eyebrow">Delete {contentKinds[kind].label}</p><h2>{title}</h2>
        <p>This permanently deletes this {contentKinds[kind].label}. {kind === "media" ? "The uploaded file and all its links will be removed." : kind === "board" ? "The board layout and drawing will be removed. Source records remain in your library." : kind === "research_session" ? "Saved references and boards remain available." : "Links to this record will be removed. Other source records, files, notes, and boards remain available."} Existing board cards for a deleted source show “Source removed”.</p>
        <label className="field"><span>Type DELETE to confirm</span><input autoFocus value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" disabled={pending} /></label>
        {error && <p role="alert" className="notice notice-error">{error}</p>}
        <div className="inline-actions"><button className="button" type="button" disabled={pending} onClick={() => dialog.current?.close()}>Cancel</button><button className="button button-danger" disabled={pending || confirmation !== "DELETE"}>{pending ? "Deleting…" : "Permanently delete"}</button></div>
      </form>
    </dialog></>;
}

export function LibraryEditor({ kind, id, title, text, altText = "" }: { kind: "media" | "note"; id: string; title: string; text: string; altText?: string }) {
  const [pending, start] = useTransition(); const [status, setStatus] = useState(""); const router = useRouter();
  return <details className="library-editor"><summary>Edit {kind === "media" ? "details" : "note"}</summary><form className="form-stack" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); start(async () => { try { await editLibraryContent(kind, id, { title: String(form.get("title")), text: String(form.get("text")), altText: String(form.get("alt_text") || "") }); setStatus("Saved."); router.refresh(); } catch (e) { setStatus(e instanceof Error ? e.message : "Unable to save."); } }); }}>
    <label className="field"><span>Title</span><input name="title" defaultValue={title} maxLength={200} required /></label>
    <label className="field"><span>{kind === "media" ? "Caption / description" : "Note"}</span><textarea name="text" defaultValue={text} rows={5} maxLength={50000} /></label>
    {kind === "media" && <label className="field"><span>Image description for accessibility</span><input name="alt_text" defaultValue={altText} maxLength={2000} /></label>}
    <button className="button" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button><p role="status">{status}</p>
  </form></details>;
}
