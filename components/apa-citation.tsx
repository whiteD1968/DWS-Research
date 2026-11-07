"use client";

import { useState } from "react";
import { citationHtml, citationText, type CitationPart } from "@/lib/citation";

// Renders an APA reference with italics and copies it as rich text, so italics survive a paste into Word or Docs.
export function ApaCitation({ parts, compact = false }: { parts: CitationPart[]; compact?: boolean }) {
  const [copied, setCopied] = useState("");
  async function copy() {
    const text = citationText(parts);
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({
          "text/html": new Blob([`<p style="padding-left:0.5in;text-indent:-0.5in">${citationHtml(parts)}</p>`], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        })]);
      } else await navigator.clipboard.writeText(text);
      setCopied("Copied");
    } catch { setCopied("Copy failed. Select the text instead."); }
  }
  return <div className={compact ? "apa-citation is-compact" : "apa-citation"}>
    <p className="apa-citation-text">{parts.map((part, index) => part.italic ? <i key={index}>{part.text}</i> : <span key={index}>{part.text}</span>)}</p>
    <div className="inline-actions"><button type="button" className="text-button" onClick={copy}>Copy citation</button>{copied && <span role="status" className="record-meta">{copied}</span>}</div>
  </div>;
}
