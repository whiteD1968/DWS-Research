// Diagramming helpers: connector presets, headed-box colours and quick-add placement.
export type ConnectorPreset = {
  id: string; label: string;
  kind: "arc" | "elbow"; dash: "draw" | "solid" | "dashed" | "dotted";
  start: "none" | "dot" | "arrow" | "bar" | "diamond"; end: "none" | "dot" | "arrow" | "bar" | "diamond";
  size: "s" | "m";
};

export const CONNECTOR_PRESETS: ConnectorPreset[] = [
  { id: "dashed-elbow", label: "Dashed elbow, dot to arrow", kind: "elbow", dash: "dashed", start: "dot", end: "arrow", size: "s" },
  { id: "solid-elbow", label: "Solid elbow arrow", kind: "elbow", dash: "solid", start: "none", end: "arrow", size: "s" },
  { id: "dotted-elbow", label: "Dotted elbow line", kind: "elbow", dash: "dotted", start: "none", end: "none", size: "s" },
  { id: "straight", label: "Straight arrow", kind: "arc", dash: "solid", start: "none", end: "arrow", size: "s" },
  { id: "two-way", label: "Two-way arrow", kind: "arc", dash: "solid", start: "arrow", end: "arrow", size: "s" },
  { id: "sketch", label: "Hand-drawn curve", kind: "arc", dash: "draw", start: "none", end: "arrow", size: "m" },
];

/** Header-band colours for headed boxes, keyed by tldraw's colour names so the style panel drives them. */
export const BOX_COLORS: Record<string, { band: string; text: string }> = {
  black: { band: "#1d1d1b", text: "#ffffff" }, grey: { band: "#8a8d86", text: "#ffffff" },
  "light-violet": { band: "#d9c9f2", text: "#2b2140" }, violet: { band: "#6f4fb8", text: "#ffffff" },
  blue: { band: "#3c64c8", text: "#ffffff" }, "light-blue": { band: "#bcd8f2", text: "#16324a" },
  yellow: { band: "#f2c94c", text: "#2b2410" }, orange: { band: "#e2793a", text: "#ffffff" },
  green: { band: "#2f8a5b", text: "#ffffff" }, "light-green": { band: "#bfe3c4", text: "#173b20" },
  "light-red": { band: "#f2b8b8", text: "#4a1616" }, red: { band: "#c2413a", text: "#ffffff" },
  white: { band: "#ffffff", text: "#1d1d1b" },
};
export const boxColor = (name: string) => BOX_COLORS[name] ?? BOX_COLORS.black;

export const BOX_HEADER = 28;
export type Side = "top" | "right" | "bottom" | "left";

/** Where a quick-added box goes: the same size, one gap away on the chosen side. */
export function quickAddPosition(box: { x: number; y: number; w: number; h: number }, side: Side, gap = 120) {
  switch (side) {
    case "right": return { x: box.x + box.w + gap, y: box.y };
    case "left": return { x: box.x - box.w - gap, y: box.y };
    case "bottom": return { x: box.x, y: box.y + box.h + gap };
    case "top": return { x: box.x, y: box.y - box.h - gap };
  }
}
