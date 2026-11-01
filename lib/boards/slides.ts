// Slides are a board's top-level frames. Order, visibility and speaker notes live in each
// frame's meta, so they save with the board snapshot and need no extra storage.
export type SlideFrame = { id: string; x: number; y: number; name: string; meta: Record<string, unknown> };
export type Slide = { id: string; name: string; hidden: boolean; notes: string; index: number };

/** Generated theme zones and record frames stay off the deck unless shown explicitly. */
export function slideHidden(meta: Record<string, unknown>) {
  if (typeof meta.slideHidden === "boolean") return meta.slideHidden;
  return !!meta.boardZone || typeof meta.recordKey === "string";
}

/** Saved order first; frames never ordered follow, reading top to bottom, left to right. */
export function orderSlides(frames: SlideFrame[]): Slide[] {
  const ordered = [...frames].sort((a, b) => {
    const ai = typeof a.meta.slideIndex === "number" ? a.meta.slideIndex : Infinity;
    const bi = typeof b.meta.slideIndex === "number" ? b.meta.slideIndex : Infinity;
    if (ai !== bi) return ai - bi;
    const row = Math.abs(a.y - b.y) < 40 ? 0 : a.y - b.y;
    return row || a.x - b.x || (a.id < b.id ? -1 : 1);
  });
  return ordered.map((f, index) => ({ id: f.id, name: f.name || `Slide ${index + 1}`, hidden: slideHidden(f.meta), notes: typeof f.meta.slideNotes === "string" ? f.meta.slideNotes : "", index }));
}

/** Move one slide to a new position; returns the full id order. */
export function moveSlide(ids: string[], id: string, to: number) {
  const next = ids.filter(x => x !== id);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, id);
  return next;
}

export function slideFileName(position: number, name: string, ext: string) {
  const clean = name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 60) || "Slide";
  return `${String(position).padStart(2, "0")} - ${clean}.${ext}`;
}

/** Pixel size from a baseline or progressive JPEG's SOF marker. */
export function jpegSize(bytes: Uint8Array) {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marker = bytes[i + 1];
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
    }
    i += 2 + length;
  }
  throw new Error("Unreadable JPEG.");
}

function concat(chunks: Uint8Array[]) {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}
const num = (n: number) => (Math.round(n * 100) / 100).toString();

/** A PDF with one full-bleed JPEG per page. Page sizes are in points (1/72 in). */
export function buildPdf(pages: { jpeg: Uint8Array; pageWidth: number; pageHeight: number }[]) {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (d: string | Uint8Array) => { const b = typeof d === "string" ? enc.encode(d) : d; chunks.push(b); length += b.length; };
  const obj = (id: number, ...body: (string | Uint8Array)[]) => { offsets[id] = length; push(`${id} 0 obj\n`); body.forEach(push); push("\nendobj\n"); };
  push("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + 3 * i} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  pages.forEach((p, i) => {
    const page = 3 + 3 * i, image = page + 1, content = page + 2;
    const { width, height } = jpegSize(p.jpeg);
    const w = num(p.pageWidth), h = num(p.pageHeight);
    obj(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R >>`);
    obj(image, `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`, p.jpeg, "\nendstream");
    const draw = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    obj(content, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
  });
  const xref = length, size = 3 + 3 * pages.length;
  push(`xref\n0 ${size}\n0000000000 65535 f \n`);
  for (let id = 1; id < size; id++) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return concat(chunks);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** An uncompressed (stored) zip; SVG and PNG slides gain little from deflate. */
export function buildZip(files: { name: string; data: Uint8Array }[]) {
  const enc = new TextEncoder();
  const local: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = enc.encode(file.name), crc = crc32(file.data), size = file.data.length;
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true); head.setUint16(8, 0, true);
    head.setUint16(10, 0, true); head.setUint16(12, 0x21, true); head.setUint32(14, crc, true); head.setUint32(18, size, true); head.setUint32(22, size, true);
    head.setUint16(26, name.length, true); head.setUint16(28, 0, true);
    local.push(new Uint8Array(head.buffer), name, file.data);
    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true); dir.setUint16(4, 20, true); dir.setUint16(6, 20, true); dir.setUint16(8, 0x0800, true); dir.setUint16(10, 0, true);
    dir.setUint16(12, 0, true); dir.setUint16(14, 0x21, true); dir.setUint32(16, crc, true); dir.setUint32(20, size, true); dir.setUint32(24, size, true);
    dir.setUint16(28, name.length, true); dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), name);
    offset += 30 + name.length + size;
  }
  const dirBytes = concat(central);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, dirBytes.length, true); end.setUint32(16, offset, true);
  return concat([...local, dirBytes, new Uint8Array(end.buffer)]);
}
