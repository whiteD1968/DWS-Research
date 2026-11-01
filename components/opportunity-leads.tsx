"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dismissLeads, runScout, saveScoutSearches, trackLead } from "@/app/(workspace)/opportunities/scout-actions";
import { deadlineLabel, opportunityKind } from "@/lib/opportunities";
import type { Lead } from "@/lib/opportunity-scout";

// Runs the daily scout quietly after the page has loaded, and refreshes only if it found something.
export function OpportunityScout() {
  const router = useRouter(); const started = useRef(false);
  useEffect(() => {
    if (started.current) return; started.current = true;
    runScout(false).then(result => { if (result.added) router.refresh(); }).catch(() => { /* the next visit tries again */ });
  }, [router]);
  return null;
}

export function OpportunityLeads({ leads, today, limit, showAllHref }: { leads: Lead[]; today: string; limit?: number; showAllHref?: string }) {
  const router = useRouter();
  const [gone, setGone] = useState<string[]>([]);
  const [tracked, setTracked] = useState<string[]>([]);
  const [error, setError] = useState(""); const [, start] = useTransition();
  const visible = leads.filter(lead => !gone.includes(lead.id));
  if (!visible.length) return null;
  const shown = limit ? visible.slice(0, limit) : visible;
  function act(ids: string[], task: () => Promise<unknown>, keep = false) {
    setError(""); if (keep) setTracked(current => [...current, ...ids]); else setGone(current => [...current, ...ids]);
    start(async () => { try { await task(); if (keep) setTimeout(() => setGone(current => [...current, ...ids]), 900); router.refresh(); } catch (failure) { setGone(current => current.filter(id => !ids.includes(id))); setTracked(current => current.filter(id => !ids.includes(id))); setError(failure instanceof Error ? failure.message : "Something went wrong."); } });
  }
  return <section className="leads" aria-label="New opportunities">
    <div className="leads-head"><p className="eyebrow">New opportunities<span>{visible.length}</span></p>
      <span>{showAllHref && visible.length > shown.length && <Link className="text-button" href={showAllHref}>See all {visible.length} ↗</Link>}<button type="button" className="text-button" onClick={() => act(shown.map(lead => lead.id), () => dismissLeads(shown.map(lead => lead.id)))}>Dismiss {shown.length === visible.length ? "all" : "these"}</button></span>
    </div>
    <ul>{shown.map(lead => <li key={lead.id} className={tracked.includes(lead.id) ? "lead lead-tracked" : "lead"}>
      <div className="lead-body"><a href={lead.url} target="_blank" rel="noreferrer"><strong>{lead.title}</strong></a>
        <span>{[lead.source, opportunityKind(lead.kind).label, lead.deadline && deadlineLabel(lead.deadline, today)].filter(Boolean).join(" · ")}</span>
        {lead.summary && <p>{lead.summary}</p>}
      </div>
      <div className="lead-actions">{tracked.includes(lead.id) ? <span className="lead-done">✓ Tracking</span> : <>
        <button type="button" className="button button-primary" onClick={() => act([lead.id], () => trackLead(lead.id), true)}>Track</button>
        <button type="button" className="text-button" onClick={() => act([lead.id], () => dismissLeads([lead.id]))}>Dismiss</button></>}
      </div>
    </li>)}</ul>
    {error && <p className="cv-error" role="alert">{error}</p>}
  </section>;
}

export function ScoutSettings({ searches, skip, lastRun, lastError }: { searches: string[]; skip: string[]; lastRun: string; lastError: string }) {
  const router = useRouter();
  const [text, setText] = useState(searches.join("\n"));
  const [skipText, setSkipText] = useState(skip.join("\n"));
  const [status, setStatus] = useState(""); const [pending, start] = useTransition();
  const run = (task: () => Promise<string>) => { setStatus(""); start(async () => { try { setStatus(await task()); router.refresh(); } catch (failure) { setStatus(failure instanceof Error ? failure.message : "Something went wrong."); } }); };
  return <details className="scout-settings">
    <summary>Scout settings<span>{lastRun ? `Last checked ${new Date(lastRun).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}` : "Not run yet"}{lastError ? ` · ${lastError}` : ""}</span></summary>
    <p>The scout searches the web about once a day, the first time you open Home, and shows new results there. One search per line, up to eight. Words like your medium, region, or “2027” narrow the results.</p>
    <textarea value={text} onChange={event => setText(event.target.value)} rows={8} aria-label="Saved searches" />
    <label className="field scout-skip"><span>Leave out results that mention (one per line)</span>
      <textarea value={skipText} onChange={event => setSkipText(event.target.value)} rows={4} /></label>
    <div className="inline-actions">
      <button type="button" className="button" disabled={pending} onClick={() => run(async () => { await saveScoutSearches(text, skipText); return "Searches saved. They'll run on your next visit to Home."; })}>Save searches</button>
      <button type="button" className="button button-primary" disabled={pending} onClick={() => run(async () => { const result = await runScout(true); return result.added ? `Found ${result.added} new ${result.added === 1 ? "lead" : "leads"}.` : "Nothing new this time."; })}>{pending ? "Checking…" : "Check now"}</button>
      {status && <span className="scout-status" role="status">{status}</span>}
    </div>
  </details>;
}
