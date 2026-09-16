export type BoardRecord = {
  key: string; id: string; type: string; title: string; subtitle: string;
  role: "evidence" | "visual" | "thinking"; themeIds: string[];
  image?: string; href: string; topicIds: string[];
};
export const layouts = ["research_wall", "contact_sheet", "theme_clusters", "literature_precedent"] as const;
export type LayoutMode = typeof layouts[number];
export type BoardItemType = "record" | "document" | "theme" | "tool";
export type ToolItemState = { tool_id: string; configuration: Record<string, unknown> };
export type Placement = { key: string; x: number; y: number; w: number; h: number; frame: number };
export type Composition = { frames: { title: string; x: number; y: number; w: number; h: number }[]; placements: Placement[] };

// Pure layout engine: callers can supply topic, collection or Discover selections.
export function generateComposition(records: BoardRecord[], mode: LayoutMode, availableThemes = records.filter(r => r.type === "theme")): Composition {
  const unique = [...new Map(records.map(r => [r.key, r])).values()].sort((a, b) => a.key.localeCompare(b.key));
  if (unique.length > 100) throw new Error("Select at most 100 records.");
  let groups: { title: string; records: BoardRecord[] }[];
  if (mode === "contact_sheet") groups = [{ title: "Research", records: unique }];
  else if (mode === "theme_clusters") {
    const themes = [...availableThemes].sort((a, b) => a.key.localeCompare(b.key));
    groups = themes.map(t => ({ title: t.title, records: unique.filter(r => r.key === t.key || r.themeIds.includes(t.id)) }));
    groups.push({ title: "Unassigned", records: unique.filter(r => !groups.some(g => g.records.includes(r))) });
  } else {
    groups = [
      { title: "Literature / Sources", records: unique.filter(r => r.role === "evidence") },
      { title: "Precedents / Projects / Images", records: unique.filter(r => r.role === "visual") },
      { title: "Themes / Notes / Questions", records: unique.filter(r => r.role === "thinking") },
    ];
    if (mode === "literature_precedent") groups[0].title = "Literature / Evidence";
  }
  const result: Composition = { frames: [], placements: [] };
  let left = 0;
  for (const group of groups.filter(g => g.records.length)) {
    const columns = mode === "contact_sheet" ? 5 : mode === "literature_precedent" ? 2 : 3;
    const gap = mode === "contact_sheet" ? 20 : 48;
    const w = 280, h = 300, padding = 40;
    const width = Math.min(columns, group.records.length) * (w + gap) - gap + padding * 2;
    const height = Math.ceil(group.records.length / columns) * (h + gap) - gap + padding * 2;
    const frame = result.frames.length;
    result.frames.push({ title: group.title, x: left, y: 0, w: width, h: height });
    group.records.forEach((r, i) => result.placements.push({ key: r.key, frame, x: padding + i % columns * (w + gap), y: padding + Math.floor(i / columns) * (h + gap), w, h }));
    left += width + 160;
  }
  if (result.placements.length > 300) throw new Error("Too many theme placements. Select fewer themes.");
  return result;
}
