"use client";

import Link from "next/link";
import { useState } from "react";
import type { DiscoverResult } from "@/lib/discover/types";

export function DiscoverResultCard({ result, selected, disabled, referenceId, onSelect }: {
  result: DiscoverResult; selected: boolean; disabled: boolean; referenceId?: string; onSelect: (checked: boolean) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = result.imageUrl || result.thumbnailUrl;
  const sourceType = typeof result.metadata?.sourceType === "string" ? result.metadata.sourceType : "Web source";
  return <article className={selected ? "discover-result is-selected" : "discover-result"}>
    <div className="discover-image">
      {image && !imageFailed ?
        // Preview-only external media retains its original proportions.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={event => {
          if (result.thumbnailUrl && event.currentTarget.src !== result.thumbnailUrl) event.currentTarget.src = result.thumbnailUrl;
          else setImageFailed(true);
        }} /> : <span>{result.sourceName || "Image unavailable"}</span>}
      <label className="discover-check"><input type="checkbox" aria-label={`Select ${result.title}`} checked={selected} disabled={disabled}
        onChange={event => onSelect(event.target.checked)} /></label>
    </div>
    <div className="discover-result-body">
      <small className="discover-kind">{result.resultType} &middot; {sourceType}</small>
      <h3><a href={result.url} target="_blank" rel="noopener noreferrer">{result.title}</a></h3>
      <p className="discover-source">{[result.creator, result.sourceName].filter(Boolean).join(" / ")}</p>
      {result.relevanceReason && <p className="discover-relevance">{result.relevanceReason}</p>}
      {result.summary && <p className="discover-summary">{result.summary}</p>}
      {referenceId && <Link className="discover-existing" href={`/library/references/${referenceId}`}>Already in library</Link>}
      <details className="discover-details"><summary>Details</summary>
        {result.summary && <p>{result.summary}</p>}
        <dl>
          <dt>Source</dt><dd>{result.sourceName || new URL(result.url).hostname}</dd>
          <dt>URL</dt><dd><a href={result.url} target="_blank" rel="noopener noreferrer">{result.url}</a></dd>
          <dt>Date</dt><dd>{result.publishedAt || "Not supplied"}</dd>
          <dt>Classification</dt><dd>{result.resultType}</dd>
          <dt>Relevance</dt><dd>{result.relevanceReason || "Not supplied"}</dd>
        </dl>
        {result.metadata && <details><summary>Ranking and source metadata</summary><pre>{JSON.stringify(result.metadata, null, 2)}</pre></details>}
      </details>
    </div>
  </article>;
}
