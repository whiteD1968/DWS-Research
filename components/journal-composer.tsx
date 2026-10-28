"use client";
/* eslint-disable @next/next/no-img-element */
import dynamic from "next/dynamic";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createJournalEntry } from "@/app/(workspace)/journal/actions";
import { maxJournalImages } from "@/lib/journal";

const SketchPad = dynamic(() => import("./sketch-pad"), { ssr: false, loading: () => <p className="sketch-pad-loading">Opening sketch pad…</p> });
type Attachment = { file: File; url: string; sketch: boolean };
type Option = { value: string; label: string };

// Phone photos are shrunk in the browser so an entry stays well under the upload limit.
async function shrink(file: File) {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024 && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
    const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.84));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}

export function JournalComposer({ today, links }: { today: string; links: { label: string; options: Option[] }[] }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sketching, setSketching] = useState(false);
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();
  const add = (file: File, sketch: boolean) => setAttachments(current => current.length >= maxJournalImages ? current : [...current, { file, url: URL.createObjectURL(file), sketch }]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget); data.delete("photo-picker");
    attachments.forEach(item => data.append(item.sketch ? "sketches" : "photos", item.file));
    setStatus("");
    start(async () => {
      try { await createJournalEntry(data); form.current?.reset(); attachments.forEach(item => URL.revokeObjectURL(item.url)); setAttachments([]); setStatus("Saved to your journal."); router.refresh(); }
      catch (error) { setStatus(error instanceof Error ? error.message : "Could not save. Please retry."); }
    });
  }

  return <>
    <form ref={form} className="journal-composer" onSubmit={submit}>
      <div className="journal-composer-head">
        <input className="journal-title" name="title" placeholder="Title (optional)" maxLength={200} aria-label="Entry title" />
        <input className="journal-date" name="entry_date" type="date" defaultValue={today} aria-label="Entry date" />
      </div>
      <textarea className="journal-text" name="text" rows={5} maxLength={50000} placeholder="What are you thinking about? Ideas, observations, a sentence for the tenure narrative…" aria-label="Entry text" />
      {attachments.length > 0 && <ul className="journal-attachments">{attachments.map((item, index) => <li key={item.url}><img src={item.url} alt={item.sketch ? "Sketch" : "Photo"} /><span>{item.sketch ? "Sketch" : "Photo"}</span><button type="button" aria-label="Remove image" onClick={() => { URL.revokeObjectURL(item.url); setAttachments(current => current.filter((_, i) => i !== index)); }}>×</button></li>)}</ul>}
      <div className="journal-composer-actions">
        <button className="button" type="button" disabled={pending || attachments.length >= maxJournalImages} onClick={() => setSketching(true)}>✎ Sketch</button>
        <label className={`button${pending || attachments.length >= maxJournalImages ? " button-disabled" : ""}`}>◎ Photo of a sketch<input name="photo-picker" type="file" accept="image/*" capture="environment" multiple hidden disabled={pending} onChange={async event => { const picked = [...(event.target.files || [])]; event.target.value = ""; for (const file of picked) add(await shrink(file), false); }} /></label>
        {links.some(group => group.options.length) && <select className="journal-link" name="link" defaultValue="" aria-label="Link to a project or topic"><option value="">No project or topic</option>{links.map(group => group.options.length > 0 && <optgroup key={group.label} label={group.label}>{group.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>)}</select>}
        <span className="journal-status" role="status">{status}</span>
        <button className="button button-primary" disabled={pending}>{pending ? "Saving…" : "Save entry"}</button>
      </div>
    </form>
    {sketching && <div className="sketch-overlay" role="dialog" aria-label="Sketch pad"><SketchPad onCancel={() => setSketching(false)} onSave={file => { add(file, true); setSketching(false); }} /></div>}
  </>;
}
