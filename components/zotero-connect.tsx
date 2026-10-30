"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { connectZotero, disconnectZotero, syncZotero } from "@/app/(workspace)/library/references/zotero-actions";

export type ZoteroStatus = { connected: boolean; username: string; collection: string; lastSync: string; lastError: string; imported: number; pending: boolean };

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

export function ZoteroConnect({ status }: { status: ZoteroStatus }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [collection, setCollection] = useState(status.collection);
  const [editing, setEditing] = useState(!status.connected);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function run(task: () => Promise<string | void>) {
    setError(""); setMessage("");
    start(async () => { try { const text = await task(); if (text) setMessage(text); router.refresh(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Something went wrong. Please retry."); } });
  }
  const summary = (result: { added: number; updated: number; complete: boolean; failure: string }) =>
    [result.added ? `Added ${result.added}` : "", result.updated ? `updated ${result.updated}` : "", !result.added && !result.updated ? "Already up to date" : ""].filter(Boolean).join(", ") + "." + (result.complete ? "" : " More to bring in; the next sync continues.") + (result.failure ? ` ${result.failure}` : "");

  return <section className="zotero" aria-label="Zotero">
    <div className="zotero-head">
      <div><p className="eyebrow">Zotero</p>
        <h2>{status.connected ? `Synced with ${status.username || "your library"}` : "Bring in your Zotero library"}</h2>
        <p className="zotero-copy">{status.connected
          ? [`${status.imported} ${status.imported === 1 ? "reference" : "references"} from Zotero`, status.collection ? `collection ${status.collection}` : "whole library", status.lastSync ? `last synced ${when(status.lastSync)}` : ""].filter(Boolean).join(" · ") + (status.pending ? " · more waiting" : "")
          : "Books, articles, and sources you’ve saved in Zotero appear here as references, with authors, year, DOI, and tags. It checks for changes every morning."}</p>
      </div>
      {status.connected && !editing && <div className="zotero-buttons">
        <button type="button" className="button button-primary" disabled={pending} onClick={() => run(async () => summary(await syncZotero()))}>{pending ? "Syncing…" : "Sync now"}</button>
        <button type="button" className="text-button" onClick={() => setEditing(true)}>Settings</button>
      </div>}
    </div>
    {status.lastError && !message && !error && <p className="cv-error" role="alert">Last sync: {status.lastError}</p>}
    {editing && <form className="zotero-form" onSubmit={event => { event.preventDefault(); run(async () => { const result = await connectZotero(key, collection); setKey(""); setEditing(false); return summary(result); }); }}>
      <ol className="zotero-steps">
        <li>At <a href="https://www.zotero.org/settings/keys/new" target="_blank" rel="noreferrer">zotero.org → Settings → Security → Create new private key ↗</a>, tick “Allow library access” (read-only is enough) and save.</li>
        <li>Paste the key here. To sync one collection instead of everything, add its key from the collection’s web address.</li>
      </ol>
      <div className="zotero-fields">
        <label className="field"><span>API key</span><input value={key} onChange={event => setKey(event.target.value)} placeholder={status.connected ? "Paste a new key to change it" : "24 letters and numbers"} autoComplete="off" spellCheck={false} required maxLength={40} /></label>
        <label className="field"><span>Collection key (optional)</span><input value={collection} onChange={event => setCollection(event.target.value)} placeholder="e.g. ABCD1234" autoComplete="off" spellCheck={false} maxLength={12} /></label>
      </div>
      <div className="zotero-buttons">
        <button className="button button-primary" disabled={pending || !key.trim()}>{pending ? "Connecting…" : status.connected ? "Save and sync" : "Connect and sync"}</button>
        {status.connected && <button type="button" className="button" onClick={() => setEditing(false)} disabled={pending}>Cancel</button>}
        {status.connected && <button type="button" className="text-button" disabled={pending} onClick={() => run(async () => { await disconnectZotero(); setEditing(true); return "Disconnected. References already imported stay in your Library."; })}>Disconnect</button>}
      </div>
    </form>}
    {message && <p className="digest-message" role="status">{message}</p>}
    {error && <p className="cv-error" role="alert">{error}</p>}
  </section>;
}
