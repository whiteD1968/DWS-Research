import { PageScaffold } from "@/components/page-scaffold";

export default function CollectionsPage() {
  return (
    <PageScaffold
      eyebrow="Groups"
      title="Collections"
      description="Curated groupings of references, images, notes, and precedents around a topic or project need."
      status="Placeholder"
      primaryPanel={{
        kicker: "Curation",
        title: "Reference sets",
        copy: "Collections will support deliberate groupings that can feed boards, research threads, and project decisions.",
      }}
      secondaryPanel={{
        kicker: "Intent",
        title: "Quiet organization",
        copy: "Collections are planned as lightweight containers before deeper editorial tools are introduced.",
      }}
      rows={[
        { meta: "Set", title: "Facade studies", copy: "Placeholder for materials, daylight, depth, and enclosure references." },
        { meta: "Set", title: "Adaptive reuse", copy: "Placeholder for transformation strategies and precedent evidence." },
        { meta: "Set", title: "Landscape interfaces", copy: "Placeholder for thresholds between building, ground, and ecology." },
      ]}
    />
  );
}
