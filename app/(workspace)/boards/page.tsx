import { PageScaffold } from "@/components/page-scaffold";

export default function BoardsPage() {
  return (
    <PageScaffold
      eyebrow="Visual"
      title="Boards"
      description="A future visual working area for assembling references, arguments, moods, diagrams, and project narratives."
      status="Placeholder"
      primaryPanel={{
        kicker: "Boards",
        title: "Visual synthesis",
        copy: "This route reserves space for board-based research without adding tldraw, React Flow, or other canvas tools yet.",
      }}
      secondaryPanel={{
        kicker: "Milestone",
        title: "Static shell only",
        copy: "The first version establishes navigation and hierarchy so visual tooling can be chosen later.",
      }}
      rows={[
        { meta: "Board", title: "Precedent wall", copy: "Placeholder for comparative images, citations, and notes." },
        { meta: "Board", title: "Concept narrative", copy: "Placeholder for sequence, claims, and project argument." },
        { meta: "Board", title: "Material palette", copy: "Placeholder for texture, color, assembly, and supplier references." },
      ]}
    />
  );
}
