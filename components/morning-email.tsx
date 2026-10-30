"use client";
import { useRef, useState, useTransition } from "react";
import { saveDigestSettings, sendTestDigest } from "@/app/(workspace)/digest/actions";
import type { DigestSettings } from "@/lib/digest";

export function MorningEmail({ settings, lastError }: { settings: DigestSettings; lastError: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [enabled, setEnabled] = useState(settings.enabled);
  const [email, setEmail] = useState(settings.email);
  const [saved, setSaved] = useState(settings);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function run(task: () => Promise<string>) {
    setError(""); setMessage("");
    start(async () => { try { setMessage(await task()); } catch (failure) { setError(failure instanceof Error ? failure.message : "Something went wrong. Please retry."); } });
  }
  const save = () => run(async () => { const next = await saveDigestSettings(enabled, email); setSaved(next); return next.enabled ? `Saved. The first email comes tomorrow at 7am.` : "Saved. The morning email is off."; });
  const test = () => run(async () => { await sendTestDigest(email); return `Sent to ${email}. It can take a minute to arrive.`; });

  return <>
    <button type="button" className="text-button" onClick={() => { setMessage(""); setError(""); dialog.current?.showModal(); }}>Morning email{saved.enabled ? " · On" : ""}</button>
    <dialog ref={dialog} className="content-dialog calendar-dialog" aria-label="Morning email">
      <p className="eyebrow">Morning email</p>
      <h2>Start the day with one email</h2>
      <p className="calendar-copy">At 7am Eastern: today’s reminders, deadlines this week, people to follow up with, and new leads from the scout. Quiet mornings send nothing.</p>
      <label className="digest-toggle"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /> Send me the morning email</label>
      <label className="field"><span>Send to</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" maxLength={254} /></label>
      {lastError && !message && !error && <p className="cv-error" role="alert">The last email didn’t send: {lastError}</p>}
      {message && <p className="digest-message" role="status">{message}</p>}
      {error && <p className="cv-error" role="alert">{error}</p>}
      <div className="calendar-footer">
        <button type="button" className="text-button" onClick={test} disabled={pending || !email}>Send a test now</button>
        <span className="digest-buttons"><button type="button" className="button" onClick={() => dialog.current?.close()}>Close</button><button type="button" className="button button-primary" onClick={save} disabled={pending}>{pending ? "Working…" : "Save"}</button></span>
      </div>
    </dialog>
  </>;
}
