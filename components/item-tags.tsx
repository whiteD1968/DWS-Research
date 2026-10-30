"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { tagMedia, untagMedia } from "@/app/actions/library";

// An image's tags: each links to every image with it, and has an × to take it off this image.
export function ItemTags({ id, tags }: { id: string; tags: { id: string; name: string }[] }) {
  const [pending, start] = useTransition(); const [status, setStatus] = useState(""); const router = useRouter();
  const run = (work: () => Promise<void>, done: string) => start(async () => {
    try { await work(); setStatus(done); router.refresh(); } catch (e) { setStatus(e instanceof Error ? e.message : "Something went wrong. Please retry."); }
  });
  return <div className="item-tags-block">
    <ul className="item-tags" aria-label="Tags">{tags.map(tag => <li key={tag.id}>
      <Link href={`/library?view=images&tags=${encodeURIComponent(tag.id)}`}>{tag.name}</Link>
      <button type="button" aria-label={`Remove tag ${tag.name}`} title="Remove tag" disabled={pending} onClick={() => run(() => untagMedia([id], tag.id), `Removed “${tag.name}”.`)}>×</button>
    </li>)}
      <li><form onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const name = String(new FormData(form).get("tag") || "").trim(); if (name) run(async () => { await tagMedia([id], name); form.reset(); }, `Added “${name}”.`); }}>
        <input name="tag" aria-label="Add a tag" placeholder="Add tag" maxLength={60} disabled={pending} />
      </form></li>
    </ul>
    {status && <p className="item-tags-status" role="status">{status}</p>}
  </div>;
}
