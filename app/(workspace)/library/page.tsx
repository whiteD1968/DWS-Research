import { PageScaffold } from "@/components/page-scaffold";
import Link from "next/link";

export default function LibraryPage() {
  return (
    <>
      <PageScaffold
        eyebrow="Sources"
        title="Library"
        description="A source library for documents, books, articles, images, references, and captured links."
        status="Active"
        primaryPanel={{
          kicker: "Archive",
          title: "Research library",
          copy: "Library items form the durable source layer beneath projects, research threads, collections, and boards.",
        }}
        secondaryPanel={{
          kicker: "References",
          title: "First workflow",
          copy: "References can now be created once and connected into collections and projects without duplication.",
        }}
        rows={[
          {
            meta: "Source",
            title: "References",
            copy: "Create and review saved references at /library/references.",
          },
          {
            meta: "Source",
            title: "Documents",
            copy: "Placeholder for reports, papers, scans, and internal files.",
          },
          {
            meta: "Source",
            title: "Image references",
            copy: "Placeholder for photos, drawings, diagrams, and visual evidence.",
          },
        ]}
      />
      <div className="section-actions">
        <Link className="button button-primary" href="/library/references">
          Open references
        </Link>
      </div>
    </>
  );
}
