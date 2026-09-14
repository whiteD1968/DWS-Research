"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDiscoverToTopic } from "@/app/(workspace)/research/discover-actions";

export function DiscoverTopicAction({ sessionId, selected, topics, onSaved }: { sessionId: string; selected: string[]; topics: { id: string; title: string }[]; onSaved: (items: Record<string, string>) => void }) {
  const router = useRouter();
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [destination, setDestination] = useState("");
  const [pending, start] = useTransition();
  return <details className="research-add"><summary>Add to Research Topic</summary>
    <div className="research-inline"><label>Research topic<select disabled={pending} value={id} onChange={event => setId(event.target.value)}><option value="">Create new topic</option>{id && !topics.some(topic => topic.id === id) && <option value={id}>{title || "Created topic"}</option>}{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></label>
      {!id && <label>Title<input value={title} maxLength={200} onChange={event => setTitle(event.target.value)} /></label>}
      <button className="button" disabled={pending || (!id && !title.trim())} onClick={() => { setError(""); start(async () => {
        try {
          const response = await addDiscoverToTopic(sessionId, selected, id, title);
          if (response.topicId) setId(response.topicId);
          onSaved(response.savedItems);
          if (response.error) { setError(response.error); return; }
          setDestination(response.topicId); router.refresh();
        } catch { setError("Unable to add to topic. Please retry."); }
      }); }}>{pending ? "Adding..." : selected.length ? `Add ${selected.length} selected and session` : "Add current session"}</button>
    </div>{error && <p role="alert">{error}</p>}{destination && <Link href={`/research/${destination}`}>Open Research Topic</Link>}
  </details>;
}
