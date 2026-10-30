"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveKitItem } from "@/app/(workspace)/kit/actions";
import { charCount, groupKit, imageCaption, kitKind, kitKinds, wordCount, type KitImage, type KitItem, type KitKind } from "@/lib/kit";
import { thumbnailUrl } from "@/lib/thumbnails";
import { DeleteContent } from "@/components/content-controls";

export type LibraryImage = { id: string; title: string; caption: string };
type Panel = { mode: "new"; kind: KitKind } | { mode: "edit"; id: string } | null;

const updated = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }) : "");

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* the text stays selectable in the card */ } }}>{done ? "Copied" : label}</button>;
}

export function KitLibrary({ items, images, startKind, openId }: { items: KitItem[]; images: LibraryImage[]; startKind?: KitKind; openId?: string }) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(startKind ? { mode: "new", kind: startKind } : openId && items.some(item => item.id === openId) ? { mode: "edit", id: openId } : null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (panel) { if (!dialog.current?.open) dialog.current?.showModal(); } else dialog.current?.close(); }, [panel]);
  const current = panel?.mode === "edit" ? items.find(item => item.id === panel.id) : undefined;
  const groups = groupKit(items);
  const missing = ([["bio_short", "a short bio"], ["artist_statement", "an artist statement"], ["image_set", "an image set"]] as const).filter(([kind]) => !items.some(item => item.kind === kind)).map(([, phrase]) => phrase);

  return <>
    <div className="kit-toolbar">
      <div className="kit-add" role="group" aria-label="Add to your kit">{kitKinds.map(kind => <button key={kind.key} type="button" className="cv-kind" onClick={() => setPanel({ mode: "new", kind: kind.key })}>+ {kind.label}</button>)}</div>
    </div>
    {missing.length > 0 && <p className="kit-nudge">Most calls ask for {missing.join(", ").replace(/, ([^,]*)$/, " and $1")}. Add {missing.length === 1 ? "it" : "them"} once and reuse {missing.length === 1 ? "it" : "them"} everywhere.</p>}
    {groups.map(group => <section key={group.kind.key} className="kit-group" aria-label={group.kind.label}>
      <h2>{group.kind.label}<span>{group.items.length}</span></h2>
      <div className="kit-grid">{group.items.map(item => <article key={item.id} className="kit-card">
        <header><strong>{item.title}</strong><small>{item.kind === "image_set" ? `${item.images.length} ${item.images.length === 1 ? "image" : "images"}` : `${wordCount(item.text)} words · ${charCount(item.text).toLocaleString("en-US")} characters`} · {updated(item.updatedAt)}</small></header>
        {item.kind === "image_set" ? <ul className="kit-thumbs">{item.images.slice(0, 6).map(image => <li key={image.mediaId}><img src={thumbnailUrl(image.mediaId)} alt={image.title || "Image"} loading="lazy" /></li>)}{item.images.length > 6 && <li className="kit-more">+{item.images.length - 6}</li>}</ul>
          : <p className="kit-preview">{item.text}</p>}
        <footer>
          <CopyButton text={item.kind === "image_set" ? [item.images.map((image, index) => `${index + 1}. ${imageCaption(image)}`).join("\n"), item.text].filter(Boolean).join("\n\n") : item.text} label={item.kind === "image_set" ? "Copy list" : "Copy"} />
          <a className="button" href={`/kit/${item.id}/export`}>Word</a>
          <button type="button" className="text-button" onClick={() => setPanel({ mode: "edit", id: item.id })}>Edit</button>
        </footer>
      </article>)}</div>
    </section>)}
    {!items.length && <div className="empty-state wide-empty"><h2>Your kit is empty.</h2><p>Write a bio, statements, and an image set once, then attach them to any application from its checklist.</p></div>}
    <dialog ref={dialog} className="content-dialog kit-dialog" aria-label="Kit item" onClose={() => { setPanel(null); if (startKind || openId) router.replace("/kit", { scroll: false }); }}>
      {panel?.mode === "new" && <KitForm key={`new-${panel.kind}`} kind={panel.kind} images={images} onDone={() => setPanel(null)} />}
      {panel?.mode === "edit" && current && <KitForm key={current.id} item={current} kind={current.kind} images={images} onDone={() => setPanel(null)} />}
    </dialog>
  </>;
}

function KitForm({ item, kind: startKind, images, onDone }: { item?: KitItem; kind: KitKind; images: LibraryImage[]; onDone: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<KitKind>(startKind);
  const [title, setTitle] = useState(item?.title ?? "");
  const [text, setText] = useState(item?.text ?? "");
  const [picked, setPicked] = useState<KitImage[]>(item?.images ?? []);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const info = kitKind(kind);

  function save() {
    setError("");
    start(async () => {
      try { await saveKitItem({ id: item?.id, kind, title: title || info.label, text, images: picked }); router.refresh(); onDone(); }
      catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save."); }
    });
  }

  // Delete sits outside the form because its confirmation dialog is a form of its own.
  return <><form className="kit-form" onSubmit={event => { event.preventDefault(); save(); }}>
    <p className="eyebrow">{item ? "Edit kit item" : "Add to your kit"}</p>
    {!item && <div className="cv-kinds" role="radiogroup" aria-label="Kind">{kitKinds.map(option => <button key={option.key} type="button" role="radio" aria-checked={kind === option.key} className={kind === option.key ? "cv-kind cv-kind-on" : "cv-kind"} onClick={() => setKind(option.key)}>{option.label}</button>)}</div>}
    <input className="cv-title" value={title} onChange={event => setTitle(event.target.value)} placeholder={kind === "image_set" ? "e.g. Recent vessels, 2024–26" : `e.g. ${info.label} — general`} aria-label="Name" maxLength={300} autoFocus />
    <p className="kit-hint">{info.hint}</p>
    {kind === "image_set" && <ImagePicker images={images} picked={picked} onChange={setPicked} />}
    <label className="field kit-text"><span>{kind === "image_set" ? "Notes to include with the list (optional)" : "Text"}</span>
      <textarea value={text} onChange={event => setText(event.target.value)} rows={kind === "image_set" ? 3 : 12} maxLength={60000} placeholder={kind === "budget" ? "Materials — $1,200\nFiring — $400\nTotal — $1,600" : ""} />
    </label>
    {kind !== "image_set" && <p className="kit-counts" aria-live="polite">{wordCount(text)} words · {charCount(text).toLocaleString("en-US")} characters</p>}
    <div className="cv-form-actions">
      {error && <p className="cv-error" role="alert">{error}</p>}
      <button type="button" className="button" onClick={onDone} disabled={pending}>Cancel</button>
      <button className="button button-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
    </div>
  </form>
  {item && <div className="kit-delete"><DeleteContent stayOnPage kind="note" id={item.id} title={item.title} /></div>}</>;
}

function ImagePicker({ images, picked, onChange }: { images: LibraryImage[]; picked: KitImage[]; onChange: (next: KitImage[]) => void }) {
  const [query, setQuery] = useState("");
  const [browsing, setBrowsing] = useState(!picked.length);
  const chosen = new Set(picked.map(image => image.mediaId));
  const shown = images.filter(image => !query.trim() || `${image.title} ${image.caption}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 60);
  const update = (index: number, field: keyof KitImage, value: string) => onChange(picked.map((image, i) => (i === index ? { ...image, [field]: value } : image)));
  const move = (index: number, by: number) => { const next = [...picked]; const [image] = next.splice(index, 1); next.splice(index + by, 0, image); onChange(next); };
  const toggle = (image: LibraryImage) => onChange(chosen.has(image.id) ? picked.filter(entry => entry.mediaId !== image.id) : [...picked, { mediaId: image.id, title: image.title, year: "", medium: "", dimensions: "", credit: "" }].slice(0, 40));

  return <div className="kit-images">
    {picked.length > 0 && <ol className="kit-picked">{picked.map((image, index) => <li key={image.mediaId}>
      <img src={thumbnailUrl(image.mediaId)} alt="" />
      <div className="kit-caption-fields">
        <input value={image.title} onChange={event => update(index, "title", event.target.value)} placeholder="Title" aria-label={`Title of image ${index + 1}`} maxLength={200} />
        <input value={image.year} onChange={event => update(index, "year", event.target.value)} placeholder="Year" aria-label="Year" maxLength={20} />
        <input value={image.medium} onChange={event => update(index, "medium", event.target.value)} placeholder="Medium" aria-label="Medium" maxLength={200} />
        <input value={image.dimensions} onChange={event => update(index, "dimensions", event.target.value)} placeholder="Dimensions" aria-label="Dimensions" maxLength={120} />
        <small>{imageCaption(image)}</small>
      </div>
      <div className="kit-order">
        <button type="button" aria-label="Move up" disabled={!index} onClick={() => move(index, -1)}>↑</button>
        <button type="button" aria-label="Move down" disabled={index === picked.length - 1} onClick={() => move(index, 1)}>↓</button>
        <button type="button" aria-label="Remove" onClick={() => onChange(picked.filter((_, i) => i !== index))}>×</button>
      </div>
    </li>)}</ol>}
    {browsing ? <div className="kit-browser">
      <div className="kit-browser-head"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your images" aria-label="Search your images" />{picked.length > 0 && <button type="button" className="text-button" onClick={() => setBrowsing(false)}>Done picking</button>}</div>
      {images.length ? <ul className="kit-choices">{shown.map(image => <li key={image.id}><button type="button" aria-pressed={chosen.has(image.id)} className={chosen.has(image.id) ? "kit-choice kit-choice-on" : "kit-choice"} onClick={() => toggle(image)}><img src={thumbnailUrl(image.id)} alt={image.title} loading="lazy" /><span>{image.title}</span></button></li>)}</ul>
        : <p className="kit-hint">Upload images to your Library first, then pick them here.</p>}
    </div> : <button type="button" className="text-button" onClick={() => setBrowsing(true)}>+ Add images</button>}
  </div>;
}
