"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { finishCvPdf, prepareCvPdf, saveCvEntry } from "@/app/(workspace)/tenure/cv/actions";
import { cvCategories, cvCategory, cvCitation, cvYears, type CvCategory, type CvFields } from "@/lib/cv";
import { sectionLabel } from "@/lib/dossier";
import { shrinkImage } from "@/lib/shrink-image";
import { pdfValidation } from "@/lib/topic-pdf";

export type CvEntry = CvFields & { id: string; notes: string };
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A short form for logging something the moment it's done; the citation preview shows how it will read on the CV.
export function CvEntryForm({ entry, prefill, onDone }: { entry?: CvEntry; prefill?: Partial<CvEntry>; onDone: (id?: string) => void }) {
  const router = useRouter();
  const seed: Partial<CvEntry> | undefined = entry ?? prefill;
  const [category, setCategory] = useState<CvCategory>(seed?.category ?? "group_exhibition");
  const [values, setValues] = useState({ title: seed?.title ?? "", venue: seed?.venue ?? "", location: seed?.location ?? "", people: seed?.people ?? "", url: seed?.url ?? "", notes: seed?.notes ?? "" });
  const [year, setYear] = useState(() => seed?.date?.slice(0, 4) ?? String(new Date().getFullYear()));
  const [month, setMonth] = useState(seed?.date?.slice(5, 7) ?? "");
  const [endYear, setEndYear] = useState(seed?.end_date?.slice(0, 4) ?? "");
  const [more, setMore] = useState(Boolean(seed && (seed.people || seed.url || seed.end_date || seed.notes)));
  const [files, setFiles] = useState<File[]>([]);
  const [dossier, setDossier] = useState(true);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const kind = cvCategory(category);
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => setValues(current => ({ ...current, [key]: event.target.value }));
  const preview = values.title ? `${cvYears({ date: year, end_date: endYear })}   ${cvCitation({ category, ...values, date: year, end_date: endYear })}` : "";

  function save() {
    setError("");
    start(async () => {
      try {
        const data = new FormData();
        if (entry) data.set("id", entry.id);
        data.set("category", category); data.set("year", year); data.set("month", month); data.set("end_year", endYear);
        Object.entries(values).forEach(([key, value]) => data.set(key, value));
        if (!dossier) data.set("dossier", "off");
        const pdfs = files.filter(file => file.type === "application/pdf");
        for (const file of files.filter(file => file.type.startsWith("image/"))) data.append("images", await shrinkImage(file));
        const id = await saveCvEntry(data);
        // PDFs can be large, so they go straight to storage rather than through the form.
        for (const file of pdfs) {
          const uploadId = crypto.randomUUID();
          const path = await prepareCvPdf(id, uploadId, file.name);
          const { error: uploadError } = await createClient().storage.from("research-documents").upload(path, file, { contentType: "application/pdf", upsert: false });
          if (uploadError) throw new Error(`The entry saved, but ${file.name} didn't upload. Edit the entry to try again.`);
          await finishCvPdf(id, uploadId, file.name);
        }
        router.refresh(); onDone(id);
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save. Please retry."); }
    });
  }

  function pick(list: FileList | null) {
    const picked = [...(list || [])];
    const usable = (file: File) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) || !pdfValidation(file.type, file.size);
    const bad = picked.filter(file => !usable(file));
    setError(bad.length ? `${bad.map(file => file.name).join(", ")} ${bad.length === 1 ? "isn't" : "aren't"} a JPEG, PNG, WebP, or PDF under 20 MB.` : "");
    setFiles(current => [...current, ...picked.filter(usable)].slice(0, 8));
  }

  return <form className="cv-form" onSubmit={event => { event.preventDefault(); save(); }} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); save(); } }}>
    <div className="cv-kinds" role="radiogroup" aria-label="What did you finish?">
      {cvCategories.map(option => <button key={option.key} type="button" role="radio" aria-checked={category === option.key} className={category === option.key ? "cv-kind cv-kind-on" : "cv-kind"} onClick={() => setCategory(option.key)}>{option.one}</button>)}
    </div>
    <input className="cv-title" value={values.title} onChange={set("title")} placeholder="Title" aria-label="Title" maxLength={300} autoFocus required />
    <div className="cv-row">
      <label className="field"><span>{kind.venue}</span><input value={values.venue} onChange={set("venue")} maxLength={300} /></label>
      <label className="field"><span>City, state or country</span><input value={values.location} onChange={set("location")} maxLength={200} /></label>
    </div>
    <div className="cv-row cv-row-dates">
      <label className="field"><span>Year</span><input value={year} onChange={event => setYear(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" required /></label>
      <label className="field"><span>Month (optional)</span><select value={month} onChange={event => setMonth(event.target.value)}><option value="">—</option>{months.map((label, index) => <option key={label} value={String(index + 1).padStart(2, "0")}>{label}</option>)}</select></label>
      {!more && <button type="button" className="text-button cv-more" onClick={() => setMore(true)}>More details</button>}
    </div>
    {more && <div className="cv-row">
      {kind.people && <label className="field"><span>{kind.people}</span><input value={values.people} onChange={set("people")} maxLength={300} /></label>}
      <label className="field"><span>Through year (optional)</span><input value={endYear} onChange={event => setEndYear(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" /></label>
      <label className="field cv-wide"><span>Link</span><input value={values.url} onChange={set("url")} type="url" placeholder="https://" maxLength={500} /></label>
      <label className="field cv-wide"><span>Notes (not exported)</span><textarea value={values.notes} onChange={set("notes")} rows={2} maxLength={20000} /></label>
    </div>}
    <label className={`cv-drop${files.length ? " cv-drop-filled" : ""}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); pick(event.dataTransfer.files); }}>
      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple hidden onChange={event => { pick(event.target.files); event.target.value = ""; }} />
      {files.length ? <ul>{files.map((file, index) => <li key={`${file.name}-${index}`}>{file.type === "application/pdf" ? "PDF" : "Image"} · {file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={event => { event.preventDefault(); setFiles(current => current.filter((_, i) => i !== index)); }}>×</button></li>)}</ul> : <span>Drop images or a PDF here, or <u>choose files</u></span>}
    </label>
    {preview && <p className="cv-preview" aria-label="How it will read on your CV">{preview}</p>}
    <div className="cv-form-actions">
      {!entry && <label className="cv-dossier"><input type="checkbox" checked={dossier} onChange={event => setDossier(event.target.checked)} /> Add to dossier · {sectionLabel(kind.section)}</label>}
      {error && <p className="cv-error" role="alert">{error}</p>}
      <button type="button" className="button" onClick={() => onDone()} disabled={pending}>Cancel</button>
      <button className="button button-primary" disabled={pending || !values.title.trim()}>{pending ? "Saving…" : entry ? "Save" : "Log it"}</button>
    </div>
  </form>;
}
