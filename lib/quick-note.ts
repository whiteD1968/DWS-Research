// Any part of the app can open the floating Quick Note, optionally straight into the sketch pad.
export const quickNoteEvent = "dws:quick-note";
export type QuickNoteRequest = { sketch?: boolean };
export function openQuickNote(request: QuickNoteRequest = {}) {
  window.dispatchEvent(new CustomEvent<QuickNoteRequest>(quickNoteEvent, { detail: request }));
}

// The browser's own calendar day, so a late-night note lands on the day you wrote it.
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
