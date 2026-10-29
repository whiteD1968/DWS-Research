"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addEvidence, removeEvidence, saveStatement, searchEvidence, setReviewDate } from "@/app/(workspace)/tenure/actions";
import { wordCount } from "@/lib/dossier";

type Result = { value: string; label: string; kind: string };

export function ReviewDate({ value }: { value: string }) {
  const router = useRouter(); const [pending, start] = useTransition(); const [error, setError] = useState("");
  return <label className="dossier-review-input"><span>Review date</span>
    <input type="date" defaultValue={value} disabled={pending} onChange={event => { const next = event.target.value; setError(""); start(async () => { try { await setReviewDate(next); router.refresh(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save."); } }); }} />
    {error && <small role="alert">{error}</small>}
  </label>;
}

// Statements save when you pause or leave the box, like a notes app; ⌘/Ctrl+S saves right away.
export function StatementEditor({ section, label, initial, placeholder }: { section: string; label: string; initial: string; placeholder: string }) {
  const [text, setText] = useState(initial); const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState(""); const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(text);
  function save(value = latest.current) {
    if (timer.current) clearTimeout(timer.current);
    if (value === saved) return;
    start(async () => {
      try { await saveStatement(section, value); setSaved(value); setStatus("Saved"); }
      catch (failure) { setStatus(failure instanceof Error ? failure.message : "Could not save. Please retry."); }
    });
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <div className="dossier-statement">
    <textarea value={text} rows={7} maxLength={50000} placeholder={placeholder} aria-label={`${label} statement`}
      onChange={event => { const value = event.target.value; setText(value); latest.current = value; setStatus(""); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => save(value), 1500); }}
      onBlur={() => save()} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); save(); } }} />
    <p className="dossier-statement-foot"><span>{wordCount(text)} words</span><span role="status">{pending ? "Saving…" : status || (text !== saved ? "Unsaved" : "")}</span></p>
  </div>;
}

export function EvidencePicker({ section, label }: { section: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false); const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]); const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const text = query.trim();
    const handle = setTimeout(async () => { try { setResults(text.length < 2 ? [] : await searchEvidence(text)); } catch { setResults([]); } }, 220);
    return () => clearTimeout(handle);
  }, [query, open]);
  function add(result: Result) {
    setError("");
    start(async () => {
      try { await addEvidence(section, result.value); setQuery(""); setResults([]); router.refresh(); input.current?.focus(); }
      catch (failure) { setError(failure instanceof Error ? failure.message : "Could not add that item."); }
    });
  }
  if (!open) return <button type="button" className="dossier-add" onClick={() => { setOpen(true); setTimeout(() => input.current?.focus(), 0); }}>+ Add evidence</button>;
  return <div className="dossier-picker">
    <input ref={input} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search projects, references, images, notes…" aria-label={`Search for ${label} evidence`} onKeyDown={event => { if (event.key === "Escape") { setOpen(false); setQuery(""); } }} />
    {query.trim().length >= 2 && <ul className="dossier-results" role="listbox">{results.length ? results.map(result => <li key={result.value}><button type="button" disabled={pending} onClick={() => add(result)}><strong>{result.label}</strong><span>{result.kind}</span></button></li>) : <li className="dossier-results-empty">Nothing matches yet.</li>}</ul>}
    <button type="button" className="text-button" onClick={() => { setOpen(false); setQuery(""); }}>Done</button>
    {error && <p className="dossier-error" role="alert">{error}</p>}
  </div>;
}

export function RemoveEvidence({ id, title }: { id: string; title: string }) {
  const router = useRouter(); const [pending, start] = useTransition();
  return <button type="button" className="dossier-remove" disabled={pending} aria-label={`Remove ${title} from the dossier`} title="Remove from dossier" onClick={() => start(async () => { try { await removeEvidence(id); router.refresh(); } catch { /* the row stays; a refresh shows the true state */ } })}>×</button>;
}

export function PrintDossier() {
  return <button type="button" className="button" onClick={() => window.print()}>Print or save PDF</button>;
}
