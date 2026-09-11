import { PageScaffold } from "@/components/page-scaffold";

export default function LibraryPage() {
  return (
    <PageScaffold
      eyebrow="Sources"
      title="Library"
      description="A source library for documents, books, articles, images, references, and captured links."
      status="Placeholder"
      primaryPanel={{
        kicker: "Archive",
        title: "Research library",
        copy: "Library items will become the durable source layer beneath projects, research threads, collections, and boards.",
      }}
      secondaryPanel={{
        kicker: "Later",
        title: "No ingestion stack yet",
        copy: "PDF.js, Uppy, and AI extraction packages are intentionally deferred beyond this first milestone.",
      }}
      rows={[
        { meta: "Source", title: "Documents", copy: "Placeholder for reports, papers, scans, and internal files." },
        { meta: "Source", title: "Web references", copy: "Placeholder for saved links, excerpts, and citation notes." },
        { meta: "Source", title: "Image references", copy: "Placeholder for photos, drawings, diagrams, and visual evidence." },
      ]}
    />
  );
}
