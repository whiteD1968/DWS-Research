"use client";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { captureImages, captureDestinations } from "@/app/actions/capture";
function SaveCapture() { const { pending } = useFormStatus(); return <button className="button button-primary" disabled={pending}>{pending ? "Saving images…" : "Save images"}</button>; }
export function CapturePanel() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [destinations, setDestinations] = useState<{ projects: {id: string; title: string}[]; references: {id: string; title: string}[] }>({ projects: [], references: [] });
  const [destination, setDestination] = useState(""); const [error, setError] = useState("");
  return <><button className="button button-primary" onClick={() => { dialog.current?.showModal(); setError(""); void captureDestinations().then(setDestinations).catch(e => setError(e.message)); }} type="button">+ Capture</button>
    <dialog ref={dialog} className="content-dialog" aria-label="Capture images"><div className="capture-header"><div><p className="eyebrow">Capture</p><h2>Add to your visual library</h2></div><button className="text-button" onClick={() => dialog.current?.close()} type="button">Close</button></div>
      <form action={captureImages} className="form-stack"><label className="drop-field"><span>Select images</span><input accept="image/jpeg,image/png,image/webp" multiple name="images" required type="file" /></label>
        <label className="field"><span>Optional title</span><input name="title" placeholder="Untitled visual study" maxLength={200} /></label>
        <label className="field"><span>Save to</span><select value={destination} onChange={e => setDestination(e.target.value)}><option value="">Library — organize later</option><optgroup label="Projects">{destinations.projects.map(item => <option key={item.id} value={`project:${item.id}`}>{item.title}</option>)}</optgroup><optgroup label="References">{destinations.references.map(item => <option key={item.id} value={`reference:${item.id}`}>{item.title}</option>)}</optgroup></select></label>
        <input name="project_id" type="hidden" value={destination.startsWith("project:") ? destination.split(":")[1] : ""} /><input name="reference_id" type="hidden" value={destination.startsWith("reference:") ? destination.split(":")[1] : ""} />
        {error && <p role="status">{error}</p>}<SaveCapture />
      </form>
    </dialog></>;
}
