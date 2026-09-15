export const researchTypes = ["Fabrication", "Materials", "Computation / AI", "Historical / Theoretical", "Structural / Geometric", "Product / Tool Development", "Teaching / Pedagogy", "Literature Review", "Other"];
export function researchArea(metadata: Record<string, unknown> = {}) {
  return typeof metadata.research_area === "string" && metadata.research_area.trim() ? metadata.research_area.trim() : "Unassigned area";
}
export function researchType(metadata: Record<string, unknown> = {}) {
  return typeof metadata.research_type === "string" && metadata.research_type.trim() ? metadata.research_type : "Other";
}
