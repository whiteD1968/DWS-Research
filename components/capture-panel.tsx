"use client";

import { useState } from "react";
import { captureImages } from "@/app/actions/capture";

export function CapturePanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="button button-primary" onClick={() => setOpen(true)} type="button">
        + Capture
      </button>

      {open ? (
        <div className="capture-overlay" role="dialog" aria-modal="true" aria-label="Capture images">
          <div className="capture-panel">
            <div className="capture-header">
              <div>
                <p className="eyebrow">Capture</p>
                <h2>Images</h2>
              </div>
              <button className="text-button" onClick={() => setOpen(false)} type="button">
                Close
              </button>
            </div>
            <form action={captureImages} className="form-stack">
              <label className="drop-field">
                <span>Drop or select multiple images</span>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  name="images"
                  required
                  type="file"
                />
              </label>
              <label className="field">
                <span>Optional title</span>
                <input name="title" placeholder="Untitled visual study" />
              </label>
              <label className="field">
                <span>Reference ID</span>
                <input name="reference_id" placeholder="Optional existing reference id" />
              </label>
              <label className="field">
                <span>Project ID</span>
                <input name="project_id" placeholder="Optional existing project id" />
              </label>
              <label className="field">
                <span>Collection ID</span>
                <input name="collection_id" placeholder="Optional collection id if assigning a reference" />
              </label>
              <button className="button button-primary" type="submit">
                Save images
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
