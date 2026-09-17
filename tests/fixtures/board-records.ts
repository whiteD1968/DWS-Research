import type { BoardRecord } from "../../lib/boards/layout";
const base = (id: string, type: string, extra: Partial<BoardRecord> = {}): BoardRecord => ({
  key: `${type === "document" ? "media" : type}:${id}`, id, type, title: `${type} ${id}`,
  subtitle: "", role: type === "note" || type === "theme" ? "thinking" : type === "document" ? "evidence" : "visual",
  href: `/research/fixture?source=${id}`, topicIds: ["fixture"], themeIds: [], ...extra,
});
export function boardFixtureRecords(scenario: string): BoardRecord[] {
  const themes = [base("materials", "theme", { title: "Material systems", subtitle: "Layer, grain and assembly" }), base("toolpath", "theme", { title: "Toolpath control", subtitle: "Movement becomes structure" })];
  const notes = [base("question", "note", { title: "Where does stiffness come from?", body: "Compare the rib depth with the direction of deposition.", themeIds: ["materials", "toolpath"] }), base("observation", "note", { title: "Read the section", body: "The continuous bead makes the manufacturing process legible.\n\nA change of direction is both a structural decision and a visible seam. Test whether the panel can remain self-supporting without adding a second material.", themeIds: ["materials"] })];
  const visual = (i: number, type = "reference") => base(`visual-${i}`, type, { title: ["Deposited shell / prototype", "Folded timber pavilion", "A study in woven surfaces", "Section through a printed wall", "Casting light and shadow"][i % 5], creator: ["Studio Fieldwork", "Workshop North", "Material Practice"][i % 3], detail: "2025 · Prototype", image: i % 2 ? "/board-fixture-assets/portrait.svg" : "/board-fixture-assets/landscape.svg", imageWidth: i % 2 ? 600 : 1200, imageHeight: i % 2 ? 900 : 720, themeIds: [i % 2 ? "toolpath" : "materials"] });
  const document = (i: number) => base(`paper-${i}`, "document", { title: ["Anisotropy in large-scale additive manufacturing", "Material agency and robotic fabrication", "Designing through deposition"][i % 3], creator: "A. Researcher & B. Designer", detail: "Journal of Fabrication · 2024", subtitle: "Research paper · full-text.pdf" });
  if (scenario === "A") return [...notes, ...themes];
  if (scenario === "B") return Array.from({ length: 5 }, (_, i) => visual(i));
  if (scenario === "C") return [...Array.from({ length: 3 }, (_, i) => document(i)), ...Array.from({ length: 5 }, (_, i) => visual(i))];
  const count = scenario === "D" ? 20 : scenario === "F" ? 100 : 50;
  return [...themes, ...notes, ...Array.from({ length: count - 4 }, (_, i) => i % 5 === 0 ? document(i) : visual(i, i % 11 === 0 ? "collection" : i % 4 === 0 ? "project" : i % 3 === 0 ? "media" : "reference"))];
}
