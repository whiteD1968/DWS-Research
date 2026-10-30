import { Document, Packer, Paragraph, TextRun } from "docx";
import { imageCaption, kitKind, type KitItem } from "@/lib/kit";

// Named styles, like the CV export, so the text can be placed into a designed template.
export const kitStyleNames = { title: "Packet Title", meta: "Packet Meta", heading: "Packet Heading", body: "Packet Body", image: "Image List" };

function itemParagraphs(item: KitItem, withHeading: boolean) {
  const out: Paragraph[] = [];
  if (withHeading) out.push(new Paragraph({ text: item.title, style: "PacketHeading" }));
  if (item.kind === "image_set") {
    item.images.forEach((image, index) => out.push(new Paragraph({ style: "ImageList", children: [new TextRun(`${index + 1}. `), new TextRun({ text: imageCaption(image) })] })));
  }
  for (const block of item.text.split(/\n{2,}/).map(part => part.trim()).filter(Boolean)) {
    const lines = block.split("\n");
    out.push(new Paragraph({ style: "PacketBody", children: lines.flatMap((line, index) => [new TextRun({ text: line, break: index ? 1 : 0 })]) }));
  }
  return out;
}

export async function kitDocx({ title, meta = [], items }: { title: string; meta?: string[]; items: KitItem[] }) {
  const single = items.length === 1 && !meta.length;
  const children: Paragraph[] = [new Paragraph({ text: title, style: "PacketTitle" })];
  for (const line of meta) children.push(new Paragraph({ text: line, style: "PacketMeta" }));
  for (const item of items) children.push(...itemParagraphs(item, !single));
  const doc = new Document({
    creator: "DWS Research",
    title,
    styles: {
      default: { document: { run: { font: "Helvetica", size: 21 } } },
      paragraphStyles: [
        { id: "PacketTitle", name: kitStyleNames.title, basedOn: "Normal", next: "PacketMeta", run: { bold: true, size: 32 }, paragraph: { spacing: { after: 120 } } },
        { id: "PacketMeta", name: kitStyleNames.meta, basedOn: "Normal", run: { size: 18, color: "666666" }, paragraph: { spacing: { after: 40 } } },
        { id: "PacketHeading", name: kitStyleNames.heading, basedOn: "Normal", next: "PacketBody", run: { bold: true, size: 24 }, paragraph: { spacing: { before: 400, after: 120 }, keepNext: true } },
        { id: "PacketBody", name: kitStyleNames.body, basedOn: "Normal", paragraph: { spacing: { after: 160, line: 300 } } },
        { id: "ImageList", name: kitStyleNames.image, basedOn: "Normal", paragraph: { indent: { left: 360, hanging: 360 }, spacing: { after: 100 } } },
      ],
    },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 } } }, children }],
  });
  return Packer.toBuffer(doc);
}

export const docxHeaders = (name: string) => ({
  "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "Content-Disposition": `attachment; filename="${name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "export"}.docx"`,
  "Cache-Control": "private, no-store",
});
export const kitFileName = (item: KitItem) => `${kitKind(item.kind).label} - ${item.title}`;
