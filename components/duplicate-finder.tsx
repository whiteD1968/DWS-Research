"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fingerprintNextImages, keepOneImage, notDuplicates } from "@/app/(workspace)/library/duplicates/actions";
import { thumbnailUrl } from "@/lib/thumbnails";

export type DuplicateImage = { id: string; title: string; width: number; height: number; createdAt: string; tags: number; source: string; named: boolean };
type Group = { keep: string; images: DuplicateImage[] };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const when = (iso: string) => iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }) : "";
async function value<T>(call: Promise<Result<T>>) { const result = await call; if (!result.ok) throw new Error(result.error); return result.value; }

// Fingerprints any images not checked yet, then shows each set of look-alikes so one copy can be kept.
export function DuplicateFinder({ groups, unchecked, total }: { groups: Group[]; unchecked: number; total: number }) {
  const router = useRouter();
  const [left, setLeft] = useState(unchecked);
  const [checking, setChecking] = useState(unchecked > 0);
  const [problem, setProblem] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (!unchecked || started.current) return;
    started.current = true;
    (async () => {
      try {
        for (let round = 0; round < 400; round += 1) {
          const result = await value(fingerprintNextImages());
          setLeft(result.remaining);
          if (!result.remaining || (!result.hashed && !result.failed)) break;
        }
      } catch (error) { setProblem(error instanceof Error ? error.message : "Checking stopped. Refresh to continue."); }
      setChecking(false); router.refresh();
    })();
  }, [unchecked, router]);

  return <section className="duplicates" aria-label="Duplicate images">
    {checking && <p className="notice" role="status">Checking images for look-alikes… {total - left} of {total} done. Sets appear here as they’re found.</p>}
    {problem && <p className="notice notice-error" role="alert">{problem}</p>}
    {!checking && !groups.length && <div className="empty-state"><h2>No duplicates found</h2><p>None of your {total} images look like copies of each other. New uploads and Pinterest pins are checked each time you open this page.</p></div>}
    {groups.length > 0 && <p className="duplicates-count">{groups.length} {groups.length === 1 ? "set" : "sets"} of look-alikes. The suggested copy to keep is the largest one; tap another to keep it instead.</p>}
    {groups.map(group => <DuplicateGroup key={group.images.map(image => image.id).join()} group={group} />)}
  </section>;
}

function DuplicateGroup({ group }: { group: Group }) {
  const router = useRouter();
  const [keep, setKeep] = useState(group.keep);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [pending, start] = useTransition();
  const others = group.images.filter(image => image.id !== keep);

  function act(task: () => Promise<string>) {
    setError("");
    start(async () => {
      try { setDone(await task()); setConfirming(false); router.refresh(); }
      catch (problem) { setError(problem instanceof Error ? problem.message : "Something went wrong. Please retry."); }
    });
  }

  if (done) return <p className="duplicates-done" role="status">{done}</p>;
  return <article className="duplicates-group">
    <ul className="duplicates-images">
      {group.images.map(image => <li key={image.id} className={image.id === keep ? "is-kept" : ""}>
        <button type="button" onClick={() => { setKeep(image.id); setConfirming(false); }} aria-pressed={image.id === keep} disabled={pending}>
          <img src={thumbnailUrl(image.id)} alt="" loading="lazy" />
          <span className="duplicates-badge">{image.id === keep ? "Keep" : "Delete"}</span>
        </button>
        <div>
          <Link href={`/library/items/media/${image.id}`}>{image.title}</Link>
          <small>{[image.width && image.height ? `${image.width} × ${image.height}` : "", image.source, image.tags ? `${image.tags} ${image.tags === 1 ? "tag" : "tags"}` : "", when(image.createdAt)].filter(Boolean).join(" · ")}</small>
        </div>
      </li>)}
    </ul>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    {confirming
      ? <div className="duplicates-confirm" role="group" aria-label="Confirm">
          <p><strong>Delete {others.length === 1 ? "the other copy" : `the other ${others.length} copies`}?</strong> Their tags, collections, board spots and links move to the one you keep. This can’t be undone.</p>
          <div className="inline-actions">
            <button type="button" className="button button-danger" disabled={pending} onClick={() => act(async () => { const count = await value(keepOneImage(keep, others.map(image => image.id))); return `Kept one copy and deleted ${count}.`; })}>{pending ? "Deleting…" : "Yes, delete"}</button>
            <button type="button" className="button" autoFocus disabled={pending} onClick={() => setConfirming(false)}>No</button>
          </div>
        </div>
      : <div className="duplicates-actions">
          <button type="button" className="button button-primary" onClick={() => setConfirming(true)}>Keep this one, delete {others.length === 1 ? "the other" : `${others.length} others`}</button>
          <button type="button" className="text-button" disabled={pending} onClick={() => act(async () => { await value(notDuplicates(group.images.map(image => image.id))); return "Marked as not duplicates. This set won’t be suggested again."; })}>Not duplicates</button>
        </div>}
  </article>;
}
