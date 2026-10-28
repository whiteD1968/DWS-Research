"use client";
/* eslint-disable @next/next/no-img-element */
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createJournalEntry } from "@/app/(workspace)/journal/actions";
import { maxJournalImages } from "@/lib/journal";
import { localDay } from "@/lib/quick-note";

const SketchPad = dynamic(() => import("./sketch-pad"), { ssr: false, loading: () => <p className="sketch-pad-loading">Opening sketch pad…</p> });
type Attachment = { file: File; url: string; sketch: boolean };
type Option = { value: string; label: string };
export type LinkGroups = { label: string; options: Option[] }[];
type Variant = "page" | "quick" | "home";

const placeholders: Record<Variant, string> = {
  page: "What are you thinking about? Ideas, observations, a sentence for the tenure narrative…",
  quick: "Jot it down…",
  home: "What's on your mind today?",
};

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

// Drafts live in this browser only; storage can be unavailable (private windows), so every access is guarded.
const readDraft = (key: string) => { try { return JSON.parse(localStorage.getItem(key) || "null") as { title?: string; text?: string } | null; } catch { return null; } };
const writeDraft = (key: string, value: { title: string; text: string } | null) => { try { if (value && (value.title || value.text)) localStorage.setItem(key, JSON.stringify(value)); else localStorage.removeItem(key); } catch { /* drafts are a convenience */ } };

export function JournalComposer({ links, variant = "page", autoSketch = false, onSaved }: { links: LinkGroups; variant?: Variant; autoSketch?: boolean; onSaved?: () => void }) {
  const router = useRouter();
  const draftKey = `dws-journal-draft:${variant}`;
  const text = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [day, setDay] = useState(""); const [link, setLink] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sketching, setSketching] = useState(autoSketch);
  const [status, setStatus] = useState<{ tone: "saved" | "error" | "draft"; text: string } | null>(null);
  const [pending, start] = useTransition();

  // The draft and today's date come from the browser, so they are read after hydration rather than during render.
  useEffect(() => {
    const draft = readDraft(draftKey);
    /* eslint-disable react-hooks/set-state-in-effect */
    if (draft) { setTitle(draft.title || ""); setBody(draft.text || ""); setStatus({ tone: "draft", text: "Draft restored" }); }
    setDay(localDay());
    /* eslint-enable react-hooks/set-state-in-effect */
    if (variant === "quick" && !autoSketch) text.current?.focus();
  }, [draftKey, variant, autoSketch]);
  const editTitle = (value: string) => { setTitle(value); writeDraft(draftKey, { title: value, text: body }); };
  const editBody = (value: string) => { setBody(value); writeDraft(draftKey, { title, text: value }); };

  const full = attachments.length >= maxJournalImages;
  const add = (file: File, sketch: boolean) => setAttachments(current => current.length >= maxJournalImages ? current : [...current, { file, url: URL.createObjectURL(file), sketch }]);
  const empty = !body.trim() && !attachments.length;

  function save() {
    if (empty || pending) return;
    const data = new FormData();
    data.set("title", title); data.set("text", body); data.set("entry_date", day || localDay()); data.set("link", link);
    attachments.forEach(item => data.append(item.sketch ? "sketches" : "photos", item.file));
    setStatus(null);
    start(async () => {
      try {
        await createJournalEntry(data);
        attachments.forEach(item => URL.revokeObjectURL(item.url));
        setAttachments([]); setTitle(""); setBody(""); setLink(""); writeDraft(draftKey, null);
        setStatus({ tone: "saved", text: "Saved" });
        router.refresh(); onSaved?.();
      } catch (error) { setStatus({ tone: "error", text: error instanceof Error ? error.message : "Could not save. Please retry." }); }
    });
  }

  return <>
    <form className={`journal-composer journal-composer-${variant}`} onSubmit={event => { event.preventDefault(); save(); }} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); save(); } }}>
      {variant !== "quick" && <div className="journal-composer-head">
        <input className="journal-title" value={title} onChange={event => editTitle(event.target.value)} placeholder="Title (optional)" maxLength={200} aria-label="Entry title" />
        {variant === "page" && <input className="journal-date" type="date" value={day} onChange={event => setDay(event.target.value)} aria-label="Entry date" />}
      </div>}
      <textarea ref={text} className="journal-text" value={body} onChange={event => editBody(event.target.value)} rows={variant === "page" ? 5 : 3} maxLength={50000} placeholder={placeholders[variant]} aria-label="Entry text" />
      {attachments.length > 0 && <ul className="journal-attachments">{attachments.map((item, index) => <li key={item.url}><img src={item.url} alt={item.sketch ? "Sketch" : "Photo"} /><span>{item.sketch ? "Sketch" : "Photo"}</span><button type="button" aria-label="Remove image" onClick={() => { URL.revokeObjectURL(item.url); setAttachments(current => current.filter((_, i) => i !== index)); }}>×</button></li>)}</ul>}
      <div className="journal-composer-actions">
        <button className="journal-tool" type="button" disabled={pending || full} onClick={() => setSketching(true)} title="Sketch"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4-1 11-11-3-3L5 16z" /><path d="M14 6l3 3" /></svg><span>Sketch</span></button>
        <label className={`journal-tool${pending || full ? " journal-tool-disabled" : ""}`} title="Photo of a sketch"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg><span>Photo</span><input type="file" accept="image/*" capture="environment" multiple hidden disabled={pending || full} onChange={async event => { const picked = [...(event.target.files || [])]; event.target.value = ""; for (const file of picked) add(await shrink(file), false); }} /></label>
        {links.some(group => group.options.length) && <select className="journal-link" value={link} onChange={event => setLink(event.target.value)} aria-label="Link to a project or topic"><option value="">No project</option>{links.map(group => group.options.length > 0 && <optgroup key={group.label} label={group.label}>{group.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>)}</select>}
        <span className={`journal-status${status ? ` journal-status-${status.tone}` : ""}`} role="status" key={status?.text}>{status?.tone === "saved" && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}{status?.text}</span>
        <button className="button button-primary journal-save" disabled={pending || empty} aria-keyshortcuts="Meta+Enter Control+Enter">{pending ? "Saving…" : "Save"}<kbd>⌘↩</kbd></button>
      </div>
    </form>
    {sketching && <div className="sketch-overlay" role="dialog" aria-label="Sketch pad"><SketchPad onCancel={() => setSketching(false)} onSave={file => { add(file, true); setSketching(false); setTimeout(() => text.current?.focus(), 50); }} /></div>}
  </>;
}
