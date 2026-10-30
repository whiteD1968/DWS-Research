"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { describeNextImages } from "@/app/(workspace)/library/describe-actions";

// Works through undescribed images a batch at a time, so a large library can be described in one sitting.
export function ImageDescribe({ undescribed, ready }: { undescribed: number; ready: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(undescribed);
  const [done, setDone] = useState(0);
  const [message, setMessage] = useState("");
  const stop = useRef(false);

  async function go() {
    setRunning(true); setMessage(""); stop.current = false;
    let total = 0; let failed = 0;
    try {
      while (!stop.current) {
        const result = await describeNextImages();
        total += result.described; failed += result.failed; setDone(total); setLeft(result.remaining);
        if (result.stopped) { setMessage(result.stopped); break; }
        // A batch where nothing worked stops the run and shows why, rather than trying the next batch the same way.
        if (!result.described && result.failed) { setMessage(`Claude couldn’t describe these images. ${result.error ? `The error was: “${result.error}”` : ""}`); break; }
        if (!result.remaining || !result.described) break;
      }
      setMessage(current => current || `Described ${total} ${total === 1 ? "image" : "images"}.${failed ? ` ${failed} couldn’t be read; select them and try again.` : ""}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Something went wrong. Please retry."); }
    setRunning(false); router.refresh();
  }

  if (!ready) return undescribed > 0 ? <p className="image-describe image-describe-off">Automatic tagging is ready to turn on: add an <code>ANTHROPIC_API_KEY</code> in Vercel, then come back here.</p> : null;
  if (!left && !message) return null;
  return <div className="image-describe" role="region" aria-label="Describe images">
    <p>{running ? `Describing… ${done} done, ${left} to go.` : message || `${left} ${left === 1 ? "image hasn’t" : "images haven’t"} been described yet. Claude can write a caption, alt text, and tags for each one so they turn up in search and tag filters.`}</p>
    {running ? <button type="button" className="button" onClick={() => { stop.current = true; }}>Stop after this batch</button>
      : left > 0 && <button type="button" className="button button-primary" onClick={go}>Describe {left === 1 ? "it" : `${left} images`}</button>}
  </div>;
}
