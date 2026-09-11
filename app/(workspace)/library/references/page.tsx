import Link from "next/link";
import { createReference } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import { getSearchParam, type PageSearchParams } from "@/lib/search-params";

type ReferenceRecord = {
  id: string;
  title: string;
  reference_type: string;
  creator: string | null;
  description: string | null;
  why_saved: string | null;
  created_at: string;
};

export default async function ReferencesPage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const supabase = await createClient();
  const created = await getSearchParam(searchParams, "created");
  const error = await getSearchParam(searchParams, "error");

  const { data: references } = await supabase
    .from("references")
    .select("id,title,reference_type,creator,description,why_saved,created_at")
    .order("created_at", { ascending: false })
    .returns<ReferenceRecord[]>();

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Library</p>
          <h1 className="page-title">References</h1>
          <p className="page-description">
            Store each source once, then connect it into collections, projects, and future
            research contexts through link tables.
          </p>
        </div>
        <span className="status-pill">{references?.length ?? 0} records</span>
      </section>

      {created ? <p className="notice notice-success">Reference saved.</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}

      <section className="two-column">
        <form action={createReference} className="panel form-stack">
          <p className="panel-kicker">Capture</p>
          <h2 className="panel-title">Create reference</h2>

          <label className="field">
            <span>Title</span>
            <input name="title" required />
          </label>

          <label className="field">
            <span>Reference type</span>
            <select name="reference_type" required>
              <option value="">Select a type</option>
              <option value="book">Book</option>
              <option value="article">Article</option>
              <option value="website">Website</option>
              <option value="image">Image</option>
              <option value="drawing">Drawing</option>
              <option value="case_study">Case study</option>
              <option value="other">Other</option>
            </select>
          </label>

          <div className="form-grid">
            <label className="field">
              <span>Creator</span>
              <input name="creator" />
            </label>
            <label className="field">
              <span>Project name</span>
              <input name="project_name" />
            </label>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Reference date</span>
              <input name="reference_date" type="date" />
            </label>
            <label className="field">
              <span>Location</span>
              <input name="location" />
            </label>
          </div>

          <label className="field">
            <span>Source URL</span>
            <input name="source_url" type="url" />
          </label>

          <label className="field">
            <span>Description</span>
            <textarea name="description" rows={4} />
          </label>

          <label className="field">
            <span>Why saved</span>
            <textarea name="why_saved" rows={3} />
          </label>

          <button className="button button-primary" type="submit">
            Save reference
          </button>
        </form>

        <section className="record-list" aria-label="References">
          {references && references.length > 0 ? (
            references.map((reference) => (
              <Link
                className="record-card"
                href={`/library/references/${reference.id}`}
                key={reference.id}
              >
                <div className="record-card-header">
                  <span className="record-type">{reference.reference_type}</span>
                  <span className="record-date">{formatDate(reference.created_at)}</span>
                </div>
                <h2>{reference.title}</h2>
                {reference.creator ? <p className="record-meta">{reference.creator}</p> : null}
                <p>
                  {reference.description ??
                    reference.why_saved ??
                    "No description has been added yet."}
                </p>
              </Link>
            ))
          ) : (
            <div className="empty-state">
              <h2>No references yet.</h2>
              <p>Create the first reference to begin the Library.</p>
            </div>
          )}
        </section>
      </section>
    </>
  );
}
