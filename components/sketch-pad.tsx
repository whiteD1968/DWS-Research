"use client";
import { useRef, useState } from "react";
import { Tldraw, type Editor } from "tldraw";
import "tldraw/tldraw.css";

// A blank tldraw page opened on the pen; saving flattens the drawing to a PNG for the journal entry.
export default function SketchPad({ onSave, onCancel }: { onSave: (file: File) => void; onCancel: () => void }) {
  const editor = useRef<Editor | null>(null);
  const [status, setStatus] = useState("");
  async function save() {
    const current = editor.current; if (!current) return;
    const ids = [...current.getCurrentPageShapeIds()];
    if (!ids.length) { setStatus("Draw something first."); return; }
    setStatus("Saving…");
    try {
      const { blob } = await current.toImage(ids, { format: "png", background: true, padding: 32, scale: 2 });
      onSave(new File([blob], `sketch-${Date.now()}.png`, { type: "image/png" }));
    } catch { setStatus("The sketch could not be saved. Please retry."); }
  }
  return (
    <div className="sketch-pad">
      <div className="sketch-pad-bar"><p className="eyebrow">Sketch</p><span role="status">{status}</span><button className="button" type="button" onClick={onCancel}>Cancel</button><button className="button button-primary" type="button" onClick={save}>Add sketch</button></div>
      <div className="sketch-pad-canvas"><Tldraw licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY} onMount={instance => { editor.current = instance; instance.setCurrentTool("draw"); }} /></div>
    </div>
  );
}
