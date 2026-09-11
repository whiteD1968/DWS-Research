import { PageScaffold } from "@/components/page-scaffold";

export default function ResearchPage() {
  return (
    <PageScaffold
      eyebrow="Inquiry"
      title="Research"
      description="A working area for questions, notes, precedents, observations, and synthesis across architectural themes."
      status="Placeholder"
      primaryPanel={{
        kicker: "Research threads",
        title: "Questions before artifacts",
        copy: "The research area will later organize evolving questions, source notes, and synthesized findings.",
      }}
      secondaryPanel={{
        kicker: "Method",
        title: "Designed for slow thinking",
        copy: "The interface leaves room for careful reading and connection-making without visual noise.",
      }}
      rows={[
        { meta: "Thread", title: "Material systems", copy: "Placeholder for studies around assemblies, craft, reuse, and performance." },
        { meta: "Thread", title: "Urban conditions", copy: "Placeholder for district-scale observations, mappings, and policy context." },
        { meta: "Thread", title: "Practice notes", copy: "Placeholder for internal methods, references, and recurring questions." },
      ]}
    />
  );
}
