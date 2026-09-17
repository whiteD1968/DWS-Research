"use client";
/* eslint-disable @next/next/no-img-element -- External search previews retain their original proportions. */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DiscoverResult } from "@/lib/discover/types";

export function DiscoverResultCard({ result, selected, disabled, referenceId, onSelect }: {
  result: DiscoverResult; selected: boolean; disabled: boolean; referenceId?: string; onSelect: (checked: boolean) => void;
}) {
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const isImage = result.resultType === "image";
  const candidates = isImage ? [result.thumbnailUrl, result.imageUrl] : [result.imageUrl, result.thumbnailUrl];
  const image = candidates.find((url): url is string => !!url && !failedImages.includes(url));
  const sourceUrl = result.sourcePageUrl || result.url;
  const sourceType = typeof result.metadata?.sourceType === "string" ? result.metadata.sourceType : "Web source";
  const ratio = result.imageWidth && result.imageHeight ? Math.max(0.55, Math.min(2, result.imageWidth / result.imageHeight)) : 4 / 3;
  useEffect(() => { if (expanded) dialog.current?.showModal(); }, [expanded]);
  return <article className={selected ? "discover-result is-selected" : "discover-result"}>
    <div className="discover-image" style={isImage ? { aspectRatio: ratio, height: "auto" } : undefined}>
      {image ? <>
        <img src={image} alt={isImage ? result.title : ""} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedImages(previous => [...previous, image])} />
        {isImage && <button type="button" className="discover-preview-button" aria-label={`Preview ${result.title}`} onClick={() => setExpanded(true)} />}
      </> : <span>Image unavailable</span>}
      <label className="discover-check"><input type="checkbox" aria-label={`Select ${result.title}`} checked={selected} disabled={disabled} onChange={event => onSelect(event.target.checked)} /></label>
    </div>
    <div className="discover-result-body">
      <small className="discover-kind">{result.resultType} &middot; {sourceType}</small>
      <h3><a href={sourceUrl} target="_blank" rel="noopener noreferrer">{result.title}</a></h3>
      <p className="discover-source">{[result.creator, result.sourceName].filter(Boolean).join(" / ")}</p>
      {!isImage && result.relevanceReason && <p className="discover-relevance">{result.relevanceReason}</p>}
      {result.summary && <p className="discover-summary">{result.summary}</p>}
      {isImage && <div className="discover-image-links"><span>{result.imageWidth && result.imageHeight ? `${result.imageWidth} × ${result.imageHeight}` : "Size not supplied"}</span><a href={sourceUrl} target="_blank" rel="noopener noreferrer">Source page ↗</a><a href={result.imageUrl || result.url} target="_blank" rel="noopener noreferrer">Original image ↗</a></div>}
      {referenceId && <Link className="discover-existing" href={`/library/references/${referenceId}`}>Already in library</Link>}
      <details className="discover-details"><summary>Details</summary>
        {result.summary && <p>{result.summary}</p>}
        <dl><dt>Source</dt><dd>{result.sourceName || new URL(sourceUrl).hostname}</dd><dt>URL</dt><dd><a href={sourceUrl} target="_blank" rel="noopener noreferrer">{sourceUrl}</a></dd><dt>Date</dt><dd>{result.publishedAt || "Not supplied"}</dd><dt>Classification</dt><dd>{result.resultType}</dd><dt>Relevance</dt><dd>{result.relevanceReason || "Not supplied"}</dd></dl>
        {result.metadata && <details><summary>Ranking and source metadata</summary><pre>{JSON.stringify(result.metadata, null, 2)}</pre></details>}
      </details>
    </div>
    {expanded && <dialog className="discover-image-dialog" aria-label={`Image preview: ${result.title}`} ref={dialog} onCancel={() => setExpanded(false)} onClick={event => { if (event.target === event.currentTarget) setExpanded(false); }}>
      <button type="button" className="button" onClick={() => setExpanded(false)} autoFocus>Close preview</button>
      <img src={result.imageUrl || image} alt={result.title} referrerPolicy="no-referrer" onError={event => { if (result.thumbnailUrl && event.currentTarget.src !== new URL(result.thumbnailUrl, window.location.href).href) event.currentTarget.src = result.thumbnailUrl; else event.currentTarget.alt = "Image unavailable. Open the source page below."; }} />
      <p>{result.title}</p><a href={sourceUrl} target="_blank" rel="noopener noreferrer">Open source page ↗</a>
    </dialog>}
  </article>;
}
