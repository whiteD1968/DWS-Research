import { AlignmentType, Document, Packer, Paragraph, Tab, TabStopType, TextRun } from "docx";
import { cvCitation, cvYears, groupCv, type CvFields } from "@/lib/cv";

// Paragraph style names are what InDesign shows when placing the file, so they can be mapped to the CV template's styles.
export const cvStyleNames = { heading: "CV Section", entry: "CV Entry", link: "CV Link" };

export async function cvDocx(entries: (CvFields & { name?: string })[], name = "") {
  const children: Paragraph[] = [];
  if (name) children.push(new Paragraph({ text: name, heading: "Title" }));
  for (const group of groupCv(entries)) {
    children.push(new Paragraph({ text: group.category.label, style: "CVSection" }));
    for (const entry of group.entries) {
      children.push(new Paragraph({ style: "CVEntry", tabStops: [{ type: TabStopType.LEFT, position: 1080 }], children: [new TextRun({ children: [cvYears(entry), new Tab(), cvCitation(entry)] })] }));
      if (entry.url) children.push(new Paragraph({ style: "CVLink", text: entry.url }));
    }
  }
  const doc = new Document({
    creator: "DWS Research",
    title: name ? `${name} CV` : "CV",
    styles: {
      default: { document: { run: { font: "Helvetica", size: 20 } } },
      paragraphStyles: [
        { id: "CVSection", name: cvStyleNames.heading, basedOn: "Normal", next: "CVEntry", quickFormat: true, run: { bold: true, size: 22 }, paragraph: { spacing: { before: 360, after: 120 }, keepNext: true } },
        { id: "CVEntry", name: cvStyleNames.entry, basedOn: "Normal", quickFormat: true, paragraph: { indent: { left: 1080, hanging: 1080 }, spacing: { after: 80 }, alignment: AlignmentType.LEFT } },
        { id: "CVLink", name: cvStyleNames.link, basedOn: "Normal", quickFormat: true, run: { size: 16, color: "666666" }, paragraph: { indent: { left: 1080 }, spacing: { after: 80 } } },
      ],
    },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 } } }, children }],
  });
  return Packer.toBuffer(doc);
}
