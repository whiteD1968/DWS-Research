export type FramePreset = { group: string; label: string; w: number; h: number };
export type ExportScope = "frame" | "selection" | "board";

// Canvas units. Slides use common screen sizes; print sizes use 96 units per inch (CSS pixels),
// so a frame exported as SVG keeps the right proportions and a 1x PNG matches screen resolution.
// Large posters use 48 units per inch to stay workable alongside research cards.
export const FRAME_PRESETS: FramePreset[] = [
  { group: "Slides", label: "Slide 16:9", w: 1280, h: 720 },
  { group: "Slides", label: "Slide 4:3", w: 1024, h: 768 },
  { group: "Print", label: "Letter portrait", w: 816, h: 1056 },
  { group: "Print", label: "Letter landscape", w: 1056, h: 816 },
  { group: "Print", label: "A4 portrait", w: 794, h: 1123 },
  { group: "Print", label: "A4 landscape", w: 1123, h: 794 },
  { group: "Print", label: "Tabloid 11×17", w: 1056, h: 1632 },
  { group: "Print", label: "Poster 24×36", w: 1152, h: 1728 },
  { group: "Print", label: "Board 30×40", w: 1440, h: 1920 },
  { group: "Social", label: "Square 1:1", w: 1080, h: 1080 },
  { group: "Social", label: "Portrait 4:5", w: 1080, h: 1350 },
  { group: "Social", label: "Story 9:16", w: 1080, h: 1920 },
];

/** A readable, filesystem-safe export name, e.g. "Thesis wall - Slide 16-9". */
export function exportFileName(boardTitle: string, scope: ExportScope, frameName?: string) {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80);
  const board = clean(boardTitle) || "Board";
  if (scope === "frame") return `${board} - ${clean(frameName || "") || "Frame"}`;
  if (scope === "selection") return `${board} - selection`;
  return board;
}
