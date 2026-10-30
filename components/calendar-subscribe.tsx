"use client";
import { useRef, useState, useTransition } from "react";
import { calendarFeedToken, resetCalendarFeed } from "@/app/(workspace)/calendar/actions";

// Subscribing once keeps deadlines, follow-ups, reminders, and the review date in the calendar Dustin already checks.
export function CalendarSubscribe() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [token, setToken] = useState("");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const feed = token && origin ? `${origin}/calendar/${token}.ics` : "";
  const webcal = feed.replace(/^https?:/, "webcal:");

  function open() {
    dialog.current?.showModal(); setError("");
    if (!token) start(async () => { try { const feed = await calendarFeedToken(); setToken(feed.token); setOrigin(feed.base || window.location.origin); } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not load your calendar link."); } });
  }
  function reset() {
    setConfirming(false); setError("");
    start(async () => { try { const feed = await resetCalendarFeed(); setToken(feed.token); setOrigin(feed.base || window.location.origin); setCopied(false); } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not reset the link."); } });
  }
  async function copy() {
    try { await navigator.clipboard.writeText(feed); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setError("Copy didn’t work. Select the link and copy it by hand."); }
  }

  return <>
    <button type="button" className="text-button" onClick={open}>Add to calendar</button>
    <dialog ref={dialog} className="content-dialog calendar-dialog" aria-label="Add to your calendar">
      <p className="eyebrow">Calendar feed</p>
      <h2>See this in your own calendar</h2>
      <p className="calendar-copy">Subscribe once. Deadlines, follow-ups, reminders, and your review date stay in sync on their own.</p>
      <div className="calendar-link">
        <input readOnly value={pending && !feed ? "Making your link…" : feed} aria-label="Private calendar link" onFocus={event => event.currentTarget.select()} />
        <button type="button" className="button" onClick={copy} disabled={!feed}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <div className="calendar-actions">
        <a className={feed ? "button button-primary" : "button button-primary is-disabled"} aria-disabled={!feed} href={feed ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` : undefined} target="_blank" rel="noreferrer">Add to Google Calendar</a>
        <a className={feed ? "button" : "button is-disabled"} aria-disabled={!feed} href={webcal || undefined}>Open in Apple Calendar</a>
      </div>
      <ul className="calendar-notes">
        <li>Outlook: Add calendar → Subscribe from web, then paste the link.</li>
        <li>Google refreshes subscribed calendars every few hours, so a change can take a while to show up there. Apple checks every hour.</li>
        <li>Anyone with this link can see these titles. Keep it to yourself.</li>
      </ul>
      {error && <p className="cv-error" role="alert">{error}</p>}
      <div className="calendar-footer">
        {confirming ? <span className="calendar-confirm">Calendars using the old link will stop updating. <button type="button" className="text-button" onClick={reset} disabled={pending}>Reset link</button> <button type="button" className="text-button" onClick={() => setConfirming(false)}>Keep it</button></span>
          : <button type="button" className="text-button" onClick={() => setConfirming(true)} disabled={!feed || pending}>Reset link…</button>}
        <button type="button" className="button" onClick={() => dialog.current?.close()}>Done</button>
      </div>
    </dialog>
  </>;
}
