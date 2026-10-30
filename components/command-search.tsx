"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { openQuickNote } from "@/lib/quick-note";

export function CommandSearch() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        dialog.current?.showModal();
        input.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function open() {
    dialog.current?.showModal();
    input.current?.select();
  }

  function go(destination: "workspace" | "web") {
    const text = query.trim().slice(0, 120);
    dialog.current?.close();
    if (destination === "web") router.push(text ? `/discover?${new URLSearchParams({ q: text })}` : "/discover");
    else router.push(text ? `/search?${new URLSearchParams({ q: text })}` : "/search");
  }

  return (
    <>
      <button className="command-trigger" onClick={open} type="button" aria-keyshortcuts="Meta+K Control+K">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></svg>
        <span>Search everything</span>
        <kbd>⌘K</kbd>
      </button>
      <dialog ref={dialog} className="command-dialog" aria-label="Search">
        <form method="dialog" onSubmit={event => { event.preventDefault(); go("workspace"); }}>
          <label className="command-input">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></svg>
            <input ref={input} value={query} onChange={event => setQuery(event.target.value)} maxLength={120} placeholder="Search topics, projects, sources, boards…" aria-label="Search" autoFocus />
          </label>
          <div className="command-actions">
            <button className="command-option" type="submit"><strong>Search my workspace</strong><span>Enter</span></button>
            <button className="command-option" type="button" onClick={() => go("web")}><strong>Search the web in Discover</strong><span>Images, papers, projects</span></button>
            <button className="command-option" type="button" onClick={() => { dialog.current?.close(); openQuickNote(); }}><strong>New note</strong><span>⌘J</span></button>
            <button className="command-option" type="button" onClick={() => { dialog.current?.close(); openQuickNote({ sketch: true }); }}><strong>New sketch</strong><span>Opens the sketch pad</span></button>
            <button className="command-option" type="button" onClick={() => { dialog.current?.close(); router.push("/tenure/cv?new=1"); }}><strong>Log accomplishment</strong><span>Add a show, publication, or talk to your CV</span></button>
            <button className="command-option" type="button" onClick={() => { dialog.current?.close(); router.push("/opportunities?new=1"); }}><strong>Add opportunity</strong><span>Track a call, grant, or residency</span></button>
            <button className="command-option" type="button" onClick={() => { dialog.current?.close(); router.push("/contacts?new=1"); }}><strong>Add contact</strong><span>A curator, juror, or collaborator</span></button>
            <button className="command-option" type="button" onClick={() => { dialog.current?.close(); router.push("/kit"); }}><strong>Application kit</strong><span>Copy a bio, statement, or image list</span></button>
          </div>
        </form>
      </dialog>
    </>
  );
}
