import { PageScaffold } from "@/components/page-scaffold";

export default function AtlasPage() {
  return (
    <PageScaffold
      eyebrow="Places"
      title="Atlas"
      description="A geographic and contextual index for sites, precedents, regions, and place-based research."
      status="Placeholder"
      primaryPanel={{
        kicker: "Mapping",
        title: "Place records",
        copy: "Atlas entries will eventually connect locations to projects, references, images, and observations.",
      }}
      secondaryPanel={{
        kicker: "Foundation",
        title: "No map dependency yet",
        copy: "The shell intentionally avoids adding mapping or canvas packages before the workflow is defined.",
      }}
      rows={[
        { meta: "Site", title: "Field observations", copy: "Notes, images, and readings attached to a specific place." },
        { meta: "Region", title: "Context layers", copy: "Environmental, historical, infrastructural, and policy references." },
        { meta: "Precedent", title: "Comparable works", copy: "Built examples that inform site-based research." },
      ]}
    />
  );
}
