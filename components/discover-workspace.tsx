"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { runDiscover, importDiscover } from "@/app/(workspace)/discover/actions";
import type { DiscoverFilters, ResearchSession } from "@/lib/discover/types";
import { discoverMode, rankDiscoverResults } from "@/lib/discover/rank";
import { DiscoverResultCard } from "@/components/discover-result-card";
import { DiscoverTopicAction } from "@/components/discover-topic-action";

export function DiscoverWorkspace({ initial, collections, matches = {}, topics = [] }: {
  initial?: ResearchSession; collections: { id: string; title: string }[]; matches?: Record<string, string>; topics?: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initial?.query ?? "");
  const [filters, setFilters] = useState<DiscoverFilters>(initial?.filters ?? { freshness: "", topic: "", contentType: "" });
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState({ ...matches, ...initial?.saved_items });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [collectionMode, setCollectionMode] = useState(false);
  const [collectionId, setCollectionId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [destination, setDestination] = useState<string | null>(null);
  const mode = discoverMode(filters.contentType);
  const results = useMemo(() => {
    if (!initial) return [];
    // Reopening preserves the snapshot; changing mode locally previews a different order.
    return mode === discoverMode(initial.filters.contentType) ? initial.result_snapshot : rankDiscoverResults(initial.result_snapshot, initial.query, mode);
  }, [initial, mode]);

  function save(toCollection: boolean) {
    if (!initial) return;
    if (toCollection && !collectionId && !newTitle.trim()) { setError("Choose a collection or enter a new collection title."); return; }
    setError(""); setMessage("");
    startTransition(async () => {
      try {
        const response = await importDiscover(initial.id, selected, toCollection ? collectionId : undefined, toCollection && !collectionId ? newTitle : undefined);
        if (response.error) { setError(response.error); return; }
        setSaved(previous => ({ ...previous, ...response.savedItems }));
        setDestination(response.collectionId ?? null);
        setMessage(toCollection ? "Selection added to collection." : "Selection saved to library.");
        router.refresh();
      } catch { setError("Unable to save. Please try again."); }
    });
  }

  return <>
    <form className="discover-query" onSubmit={event => {
      event.preventDefault(); setError(""); setMessage("");
      startTransition(async () => {
        try {
          const response = await runDiscover(query, filters);
          if (response.error) setError(response.error);
          else if (response.session) router.push(`/discover/sessions/${response.session.id}`);
        } catch { setError("Search could not complete. Please try again."); }
      });
    }}>
      <label htmlFor="research-question">Research question</label>
      <textarea id="research-question" required maxLength={400} value={query} onChange={event => setQuery(event.target.value)}
        placeholder="Find architectural projects using robotic 3D printing with stone, concrete, clay, or bio-based materials..." />
      <div className="discover-modes" role="group" aria-label="Content mode">
        {[["all", "All"], ["project", "Projects"], ["paper", "Papers"], ["lab", "Labs"], ["video", "Videos"]].map(([value, label]) =>
          <button type="button" key={value} aria-pressed={mode === value} disabled={pending}
            onClick={() => setFilters({ ...filters, contentType: value })}>{label}</button>)}
      </div>
      <div className="discover-query-footer"><div className="discover-filters">
        <label>Date range<select disabled={Boolean(filters.yearFrom || filters.yearTo)} value={filters.freshness} onChange={event => setFilters({ ...filters, freshness: event.target.value })}>
          <option value="">Any time</option><option value="pd">Past day</option><option value="pw">Past week</option><option value="pm">Past month</option><option value="py">Past year</option>
        </select></label>
        <label>From year<input type="number" min="1900" max={new Date().getFullYear()} placeholder="Any" value={filters.yearFrom ?? ""} onChange={event => setFilters({ ...filters, yearFrom: event.target.value })} /></label>
        <label>To year<input type="number" min="1900" max={new Date().getFullYear()} placeholder="Any" value={filters.yearTo ?? ""} onChange={event => setFilters({ ...filters, yearTo: event.target.value })} /></label>
        <label>Focus<select value={filters.topic} onChange={event => setFilters({ ...filters, topic: event.target.value })}>
          <option value="">All disciplines</option>{["architecture", "fabrication", "materials"].map(value => <option key={value}>{value}</option>)}
        </select></label>
      </div><button className="button button-primary" disabled={pending} type="submit">{pending ? "Working..." : initial ? "Search again" : "Search"}</button></div>
    </form>
    {error && <p className="discover-error" role="alert">{error}</p>}
    {message && <p role="status">{message} {destination && <Link href={`/collections/${destination}`}>Open collection</Link>}</p>}
    {initial && <>
      <DiscoverTopicAction sessionId={initial.id} selected={selected} topics={topics} onSaved={items => setSaved(previous => ({ ...previous, ...items }))} />
      <div className="discover-result-heading"><h2>{results.length} results</h2><div>
        <button className="text-button" disabled={pending} onClick={() => setSelected(results.map(result => result.id))}>Select all</button>
        <button className="text-button" disabled={pending} onClick={() => setSelected([])}>Clear selection</button>
      </div></div>
      {!results.length && <p>No results for this question. Try broader terms or a different date range.</p>}
      {selected.length > 0 && <div className="discover-selection" aria-label="Selection actions">
        <strong>{selected.length} selected</strong>
        <button className="button" disabled={pending} onClick={() => save(false)}>Save as references</button>
        <button className="button" disabled={pending} onClick={() => setCollectionMode(!collectionMode)}>Add to collection</button>
        <button className="text-button" disabled={pending} onClick={() => setSelected([])}>Clear</button>
        {collectionMode && <div className="discover-collection">
          <label>Collection<select value={collectionId} onChange={event => setCollectionId(event.target.value)}>
            <option value="">Create new collection</option>{collections.map(collection => <option key={collection.id} value={collection.id}>{collection.title}</option>)}
          </select></label>
          {!collectionId && <label>New collection title<input maxLength={200} value={newTitle} onChange={event => setNewTitle(event.target.value)} /></label>}
          <button className="button" disabled={pending} onClick={() => save(true)}>Save to collection</button>
        </div>}
      </div>}
      <div className="discover-grid">{results.map(result => <DiscoverResultCard key={result.id} result={result}
        selected={selected.includes(result.id)} disabled={pending} referenceId={saved[result.id]}
        onSelect={checked => setSelected(previous => checked ? [...previous, result.id] : previous.filter(id => id !== result.id))} />)}</div>
    </>}
  </>;
}
