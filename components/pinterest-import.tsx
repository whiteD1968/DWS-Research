"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { followBoard, syncBoard, unfollowBoard } from "@/app/(workspace)/library/pinterest/actions";

type Feed = { url: string; label: string; collectionId: string; lastSync: string; lastError: string; imported: number };
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
const summary = (result: { imported: number; skipped: number; failed: number }) =>
  `${result.imported ? `Added ${result.imported} ${result.imported === 1 ? "image" : "images"}` : "No new pins"}${result.failed ? `, ${result.failed} couldn’t be saved` : ""}.`;

export function PinterestImport({ feeds }: { feeds: Feed[] }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [, start] = useTransition();

  function run(key: string, task: () => Promise<string>) {
    setBusy(key); setError(""); setMessage("");
    start(async () => {
      try { setMessage(await task()); router.refresh(); }
      catch (problem) { setError(problem instanceof Error ? problem.message : "Something went wrong. Please retry."); }
      finally { setBusy(""); }
    });
  }

  return <section className="pinterest" aria-label="Pinterest boards">
    <form className="pinterest-add" onSubmit={event => { event.preventDefault(); run("add", async () => { const result = await followBoard(input); setInput(""); return result.found ? `Following “${result.title}”. Added ${result.imported} of its ${result.found} newest pins.` : `Following “${result.title}”. It has no pins yet.`; }); }}>
      <label className="field"><span>Board link</span><input value={input} onChange={event => setInput(event.target.value)} placeholder="pinterest.com/yourname/board-name/" disabled={!!busy} required /></label>
      <button className="button button-primary" disabled={!!busy}>{busy === "add" ? "Importing…" : "Follow board"}</button>
    </form>
    <p className="pinterest-note">Open a board on Pinterest and copy its address. Your username on its own follows your most recent pins across all boards. Only public boards work, and each check brings in the newest pins (about 25 at a time), so following early and checking often catches everything new.</p>
    {message && <p className="notice" role="status">{message}</p>}
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    {feeds.length > 0 && <ul className="pinterest-boards">{feeds.map(feed => <li key={feed.url}>
      <div><strong>{feed.label}</strong>
        <small>{[`${feed.imported} imported`, feed.lastSync ? `checked ${when(feed.lastSync)}` : ""].filter(Boolean).join(" · ")}</small>
        {feed.lastError && <small className="pinterest-error">{feed.lastError}</small>}
      </div>
      <div className="pinterest-actions">
        {feed.collectionId && <Link href={`/library?view=images&in=collection:${feed.collectionId}`}>View images</Link>}
        <button type="button" className="button" disabled={!!busy} onClick={() => run(feed.url, async () => summary(await syncBoard(feed.url)))}>{busy === feed.url ? "Checking…" : "Check now"}</button>
        <button type="button" className="text-button" disabled={!!busy} onClick={() => run(`x${feed.url}`, async () => { await unfollowBoard(feed.url); return `Stopped following “${feed.label}”. Its images stay in the Library.`; })}>Unfollow</button>
      </div>
    </li>)}</ul>}
  </section>;
}
