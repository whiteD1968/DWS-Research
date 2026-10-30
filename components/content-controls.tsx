"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteContent, editLibraryContent } from "@/app/actions/content";
import { contentKinds, type ContentKind } from "@/lib/content";

export function DeleteContent({ kind, id, title, stayOnPage = false }: { kind: ContentKind; id: string; title: string; stayOnPage?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return <><button type="button" className="button button-danger-quiet" onClick={() => { setError(""); dialog.current?.showModal(); }}>Delete {contentKinds[kind].label}</button>
    <dialog ref={dialog} className="content-dialog" aria-label={`Delete ${title}`} onCancel={e => { if (pending) e.preventDefault(); }}>
      <form className="form-stack" onSubmit={e => { e.preventDefault(); start(async () => { try { const destination = await deleteContent(kind, id, "DELETE"); dialog.current?.close(); if (!stayOnPage) router.push(destination); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Deletion failed."); } }); }}>
        <p className="eyebrow">Delete {contentKinds[kind].label}</p><h2>Delete “{title}”?</h2>
        <p>{kind === "board" ? "The board goes away; its sources stay in your Library." : kind === "research_session" ? "Its saved references and boards stay in your Library." : "It will be removed everywhere it’s used."} This can’t be undone.</p>
        {error && <p role="alert" className="notice notice-error">{error}</p>}
        <div className="inline-actions"><button className="button button-danger" disabled={pending}>{pending ? "Deleting…" : "Yes, delete"}</button><button className="button" type="button" autoFocus disabled={pending} onClick={() => dialog.current?.close()}>No</button></div>
      </form>
    </dialog></>;
}

export function LibraryEditor({ kind, id, title, text, altText = "", children }: { kind: "media" | "note"; id: string; title: string; text: string; altText?: string; children?: React.ReactNode }) {
  const [pending, start] = useTransition(); const [status, setStatus] = useState(""); const router = useRouter();
  return <details className="library-editor"><summary>Edit {kind === "media" ? "details" : "note"}</summary>{children}<form className="form-stack" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); start(async () => { try { await editLibraryContent(kind, id, { title: String(form.get("title")), text: String(form.get("text")), altText: String(form.get("alt_text") || "") }); setStatus("Saved."); router.refresh(); } catch (e) { setStatus(e instanceof Error ? e.message : "Unable to save."); } }); }}>
    <label className="field"><span>Title</span><input name="title" defaultValue={title} maxLength={200} required /></label>
    <label className="field"><span>{kind === "media" ? "Caption / description" : "Note"}</span><textarea name="text" defaultValue={text} rows={5} maxLength={50000} /></label>
    {kind === "media" && <label className="field"><span>Image description for accessibility</span><input name="alt_text" defaultValue={altText} maxLength={2000} /></label>}
    <button className="button" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button><p role="status">{status}</p>
  </form></details>;
}
