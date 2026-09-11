import { PageScaffold } from "@/components/page-scaffold";

export default function TodayPage() {
  return (
    <PageScaffold
      eyebrow="Today"
      title="Today"
      description="A calm daily surface for open questions, active project threads, field notes, and decisions that need attention."
      status="Workspace shell"
      primaryPanel={{
        kicker: "Focus",
        title: "Daily research desk",
        copy: "This space will bring together current captures, project updates, and research prompts once the data model is introduced.",
      }}
      secondaryPanel={{
        kicker: "Capture",
        title: "Ready for quick intake",
        copy: "The persistent capture action is in place as the future entry point for notes, links, references, and observations.",
      }}
      rows={[
        {
          meta: "Morning",
          title: "Review active project signals",
          copy: "Placeholder for project activity, recent references, and open loops.",
        },
        {
          meta: "Research",
          title: "Collect unresolved questions",
          copy: "Placeholder for prompts that need reading, synthesis, or field validation.",
        },
        {
          meta: "Studio",
          title: "Prepare board context",
          copy: "Placeholder for boards, collections, and visual reference groupings.",
        },
      ]}
    />
  );
}
