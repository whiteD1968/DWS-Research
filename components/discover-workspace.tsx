"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runDiscover, importDiscover } from "@/app/(workspace)/discover/actions";
import type { DiscoverFilters, ResearchSession } from "@/lib/discover/types";

export function DiscoverWorkspace({ initial, collections, matches = {} }: {
  initial?: ResearchSession; collections: { id: string; title: string }[]; matches?: Record<string, string>;
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
  const results = initial?.result_snapshot ?? [];

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
      <div className="discover-query-footer"><div className="discover-filters">
        <label>Date range<select value={filters.freshness} onChange={event => setFilters({ ...filters, freshness: event.target.value })}>
          <option value="">Any time</option><option value="pd">Past day</option><option value="pw">Past week</option><option value="pm">Past month</option><option value="py">Past year</option>
        </select></label>
        <label>Content<select value={filters.contentType} onChange={event => setFilters({ ...filters, contentType: event.target.value })}>
          <option value="">All content</option>{["project", "paper", "studio", "lab", "video", "image"].map(value => <option key={value} value={value}>{value}</option>)}
        </select></label>
        <label>Focus<select value={filters.topic} onChange={event => setFilters({ ...filters, topic: event.target.value })}>
          <option value="">All disciplines</option>{["architecture", "fabrication", "materials"].map(value => <option key={value}>{value}</option>)}
        </select></label>
      </div><button className="button button-primary" disabled={pending} type="submit">{pending ? "Working..." : initial ? "Search again" : "Search"}</button></div>
    </form>
    {error && <p className="discover-error" role="alert">{error}</p>}
    {message && <p role="status">{message} {destination && <Link href={`/collections/${destination}`}>Open collection</Link>}</p>}
    {initial && <>
      <div className="discover-result-heading"><h2>{results.length} results</h2><div>
        <button className="text-button" disabled={pending} onClick={() => setSelected(results.map(result => result.id))}>Select all</button>
        <button className="text-button" disabled={pending} onClick={() => setSelected([])}>Clear selection</button>
      </div></div>
      {!results.length && <p>No results for this question. Try broader terms or a different date range.</p>}
      {selected.length > 0 && <div className="discover-selection" aria-label="Selection actions">
        <strong>{selected.length} selected</strong>
        <button className="button" disabled={pending} onClick={() => save(false)}>Save as references</button>
        <button className="button" disabled={pending} onClick={() => setCollectionMode(!collectionMode)}>Add to collection</button>
        {collectionMode && <div className="discover-collection">
          <label>Collection<select value={collectionId} onChange={event => setCollectionId(event.target.value)}>
            <option value="">Create new collection</option>{collections.map(collection => <option key={collection.id} value={collection.id}>{collection.title}</option>)}
          </select></label>
          {!collectionId && <label>New collection title<input maxLength={200} value={newTitle} onChange={event => setNewTitle(event.target.value)} /></label>}
          <button className="button" disabled={pending} onClick={() => save(true)}>Save to collection</button>
        </div>}
      </div>}
      <div className="discover-grid">{results.map(result => <article key={result.id} className={selected.includes(result.id) ? "discover-result is-selected" : "discover-result"}>
        <div className="discover-image">
          {(result.thumbnailUrl || result.imageUrl) ?
            // External previews are never promoted to stored library media.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={result.thumbnailUrl || result.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = "none"; }} /> : <span>{result.sourceName || "No image"}</span>}
          <label className="discover-check"><input type="checkbox" aria-label={`Select ${result.title}`} checked={selected.includes(result.id)} disabled={pending}
            onChange={event => setSelected(previous => event.target.checked ? [...previous, result.id] : previous.filter(id => id !== result.id))} /></label>
        </div>
        <div className="discover-result-body"><small>{result.sourceName} &middot; {result.resultType}{result.publishedAt ? ` · ${result.publishedAt.slice(0, 10)}` : ""}</small>
          <h3><a href={result.url} target="_blank" rel="noopener noreferrer">{result.title}</a></h3>
          {result.creator && <p>{result.creator}</p>}{result.summary && <p className="discover-summary">{result.summary}</p>}
          {result.relevanceReason && <p className="discover-relevance">{result.relevanceReason}</p>}
          {saved[result.id] && <Link className="discover-existing" href={`/library/references/${saved[result.id]}`}>Already in library</Link>}
        </div>
      </article>)}</div>
    </>}
  </>;
}
