import { PageScaffold } from "@/components/page-scaffold";

export default function ProjectsPage() {
  return (
    <PageScaffold
      eyebrow="Work"
      title="Projects"
      description="Project-based research areas for buildings, places, studies, competitions, and long-running architectural inquiries."
      status="Placeholder"
      primaryPanel={{
        kicker: "Structure",
        title: "Project index",
        copy: "Future project records will collect brief, site, timeline, references, research questions, and linked boards.",
      }}
      secondaryPanel={{
        kicker: "Next",
        title: "No project schema yet",
        copy: "This milestone only establishes routing and visual foundation before introducing database tables.",
      }}
      rows={[
        { meta: "Draft", title: "Project brief", copy: "Scope, participants, status, and current research agenda." },
        { meta: "Draft", title: "Site context", copy: "Geographic, cultural, regulatory, and environmental reference material." },
        { meta: "Draft", title: "Linked knowledge", copy: "Connections to library items, collections, atlas entries, and boards." },
      ]}
    />
  );
}
