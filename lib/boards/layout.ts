export type BoardRecord = {
  key: string; id: string; type: string; title: string; subtitle: string;
  role: "evidence" | "visual" | "thinking"; themeIds: string[];
  image?: string; imageWidth?: number; imageHeight?: number;
  creator?: string; detail?: string; body?: string;
  href: string; topicIds: string[];
};
export const layouts = ["research_wall", "contact_sheet", "theme_clusters", "literature_precedent"] as const;
export type LayoutMode = typeof layouts[number];
export const layoutLabels: Record<LayoutMode, string> = {
  research_wall: "Research Wall", contact_sheet: "Contact Sheet",
  theme_clusters: "Theme Clusters", literature_precedent: "Literature + Precedent",
};
export const defaultBoardTitle = (sourceTitle: string, mode: LayoutMode | "manual") =>
  `${sourceTitle} — ${mode === "manual" ? "Research Board" : layoutLabels[mode]}`;
export type BoardItemType = "record" | "document" | "theme" | "tool";
export type ToolItemState = { tool_id: string; configuration: Record<string, unknown> };
export type Placement = { key: string; x: number; y: number; w: number; h: number; frame: number; compact?: boolean };
export type Composition = {
  frames: { title: string; x: number; y: number; w: number; h: number; kind?: "zone" | "theme"; recordKey?: string }[];
  placements: Placement[];
};
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export function imageRatio(record: BoardRecord) {
  const { imageWidth: w, imageHeight: h } = record;
  return w && h && Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? w / h : 4 / 3;
}
function lines(text: string, width: number, font = 14) {
  const chars = Math.max(12, Math.floor((width - 32) / (font * 0.52)));
  return text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / chars)), 0);
}
/** Initial geometry only: the designer remains free to resize every placement. */
export function cardSize(record: BoardRecord, compact = false) {
  if (record.type === "theme") return { w: 248, h: clamp(38 + lines(record.title, 248) * 17 + (record.subtitle ? 28 : 0), 72, 128) };
  if (record.type === "note") {
    const w = compact ? 240 : 264;
    return { w, h: clamp(60 + lines(record.title, w, 17) * 21 + lines(record.body || record.subtitle, w) * 20, 104, compact ? 250 : 360) };
  }
  if (record.image) {
    const ratio = imageRatio(record);
    const w = compact ? 240 : ratio < 0.85 ? 224 : ratio > 1.65 ? 320 : 280;
    const caption = compact ? 58 : 40 + clamp(lines(record.title, w, 17), 1, 3) * 21 + (record.creator || record.subtitle ? 22 : 0);
    return { w, h: Math.round(clamp(w / ratio, 104, compact ? 300 : 360) + caption) };
  }
  const w = compact ? 240 : 280;
  return { w, h: clamp(50 + lines(record.title, w, 18) * 23 + (record.creator || record.subtitle ? 38 : 0), 124, compact ? 188 : 224) };
}

type Group = { title: string; records: BoardRecord[]; theme?: BoardRecord };
/** Pure, stable masonry layout for any source catalog, without database or topic dependencies. */
export function generateComposition(records: BoardRecord[], mode: LayoutMode, availableThemes = records.filter(r => r.type === "theme")): Composition {
  const unique = [...new Map(records.map(r => [r.key, r])).values()].sort((a, b) => a.key.localeCompare(b.key));
  if (unique.length > 100) throw new Error("Select at most 100 records.");
  const themes = [...new Map(availableThemes.map(r => [r.key, r])).values()].sort((a, b) => a.key.localeCompare(b.key));
  let groups: Group[];
  if (mode === "contact_sheet") {
    // Visual comparisons first, then citations and thinking, with stable ordering within each.
    const visual = unique.filter(r => r.image);
    groups = [{ title: "Contact Sheet", records: [...visual, ...unique.filter(r => !r.image)] }];
  } else if (mode === "theme_clusters") {
    groups = themes.map(theme => ({ title: theme.title, theme, records: unique.filter(r => r.type !== "theme" && r.themeIds.includes(theme.id)) }))
      .filter(g => g.records.length || unique.some(r => r.key === g.theme.key));
    const assigned = new Set(groups.flatMap(g => [...g.records.map(r => r.key), g.theme!.key]));
    groups.push({ title: "Unassigned", records: unique.filter(r => !assigned.has(r.key)) });
  } else if (mode === "literature_precedent") {
    groups = [
      { title: "Literature", records: unique.filter(r => r.type !== "theme" && (r.role === "evidence" || r.type === "note")) },
      { title: "Themes", records: unique.filter(r => r.type === "theme") },
      { title: "Precedents", records: unique.filter(r => r.type !== "theme" && r.type !== "note" && r.role !== "evidence") },
    ];
  } else {
    groups = [
      { title: "Literature / Evidence", records: unique.filter(r => r.role === "evidence") },
      { title: "Precedents / Projects / Images", records: unique.filter(r => r.role === "visual") },
      { title: "Themes / Notes / Questions", records: unique.filter(r => r.role === "thinking") },
    ];
  }
  const result: Composition = { frames: [], placements: [] };
  const compact = mode === "contact_sheet";
  let left = 0, top = 0, rowHeight = 0;
  const active = groups.filter(g => g.records.length || g.theme);
  for (const [groupIndex, group] of active.entries()) {
    const sizes = group.records.map(r => cardSize(r, compact));
    const maxColumns = compact ? 5 : 3;
    const columns = Math.min(maxColumns, Math.max(1, compact ? group.records.length : Math.ceil(Math.sqrt(group.records.length))));
    const gap = compact ? 16 : 24, padding = group.theme ? 20 : 8;
    const columnWidth = Math.max(248, ...sizes.map(s => s.w));
    const bottoms = Array<number>(columns).fill(padding);
    const frame = result.frames.length;
    let right = padding + 248;
    for (const [i, record] of group.records.entries()) {
      const column = bottoms.indexOf(Math.min(...bottoms));
      const { w, h } = sizes[i];
      const x = padding + column * (columnWidth + gap), y = bottoms[column];
      result.placements.push({ key: record.key, frame, x, y, w, h, ...(compact ? { compact: true } : {}) });
      bottoms[column] = y + h + gap;
      right = Math.max(right, x + w);
    }
    const w = right + padding;
    const h = Math.max(group.theme ? 80 : 40, Math.max(...bottoms) - gap + padding);
    // Theme clusters wrap as a wall rather than stretching into a long horizontal strip.
    if (mode === "theme_clusters" && groupIndex > 0 && left + w > 1800) { left = 0; top += rowHeight + 72; rowHeight = 0; }
    result.frames.push({ title: group.title, x: left, y: top, w, h, kind: group.theme ? "theme" : "zone", ...(group.theme ? { recordKey: group.theme.key } : {}) });
    left += w + (compact ? 32 : 56);
    rowHeight = Math.max(rowHeight, h);
  }
  if (result.placements.length + result.frames.filter(f => f.recordKey).length > 300) throw new Error("Too many theme placements. Select fewer themes.");
  return result;
}
