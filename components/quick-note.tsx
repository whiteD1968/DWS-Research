"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { journalLinkOptions } from "@/app/(workspace)/journal/actions";
import { JournalComposer, type LinkGroups } from "@/components/journal-composer";
import { quickNoteEvent, type QuickNoteRequest } from "@/lib/quick-note";

const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

// A floating jot pad, like Quick Note: ⌘J or N opens it anywhere, ⌘↩ saves, Esc tucks it away with the draft kept.
export function QuickNote() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sketch, setSketch] = useState(false);
  const [links, setLinks] = useState<LinkGroups | null>(null);

  useEffect(() => {
    const show = (request: QuickNoteRequest = {}) => { setSketch(!!request.sketch); setOpen(true); };
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") { event.preventDefault(); setOpen(value => !value); setSketch(false); }
      else if (event.key === "Escape") setOpen(false);
      else if (event.key.toLowerCase() === "n" && !event.metaKey && !event.ctrlKey && !event.altKey && !typing(event.target) && !document.querySelector("dialog[open]")) { event.preventDefault(); show(); }
    }
    const onRequest = (event: Event) => show((event as CustomEvent<QuickNoteRequest>).detail);
    window.addEventListener("keydown", onKey); window.addEventListener(quickNoteEvent, onRequest);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener(quickNoteEvent, onRequest); };
  }, []);
  useEffect(() => { if (open && !links) journalLinkOptions().then(setLinks).catch(() => setLinks([])); }, [open, links]);

  const onJournal = pathname === "/journal";
  return <>
    {!onJournal && <button type="button" className={`quick-note-fab${open ? " quick-note-fab-open" : ""}`} onClick={() => { setSketch(false); setOpen(value => !value); }} aria-expanded={open} aria-label={open ? "Close quick note" : "Quick note"} aria-keyshortcuts="Meta+J Control+J N" title="Quick note (⌘J)">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4-1 11-11-3-3L5 16z" /><path d="M14 6l3 3" /></svg>
    </button>}
    {open && <section className="quick-note" aria-label="Quick note">
      <header className="quick-note-head"><p>Quick note</p><span>Saved to your journal</span><button type="button" className="quick-note-close" onClick={() => setOpen(false)} aria-label="Close">×</button></header>
      <JournalComposer key={sketch ? "sketch" : "note"} variant="quick" links={links || []} autoSketch={sketch} onSaved={() => setTimeout(() => setOpen(false), 900)} />
    </section>}
  </>;
}
