export const maxPdfBytes = 20 * 1024 * 1024;
export function pdfTitle(name: string) { return name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim().slice(0, 200) || "Untitled document"; }
export function pdfPath(owner: string, topic: string, id: string, name: string) {
  if (![owner, topic, id].every(value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))) throw new Error("Invalid upload identifier.");
  return `${owner}/research/${topic}/${id}-${name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-180) || "document.pdf"}`;
}
export function pdfValidation(type: string, size: number) {
  if (type !== "application/pdf") return "Only PDF documents are supported.";
  if (!size || size > maxPdfBytes) return "Choose a PDF between 1 byte and 20 MB.";
  return null;
}
export function documentBytes(size: number) { return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`; }
