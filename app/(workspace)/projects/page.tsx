import { createProject, linkReferenceToProject } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { getSearchParam, type PageSearchParams } from "@/lib/search-params";

type Project = {
  id: string;
  title: string;
  summary: string | null;
  project_type: string | null;
  status: string | null;
};

type ReferenceOption = {
  id: string;
  title: string;
  reference_type: string;
};

type Relationship = {
  source_id: string;
  target_id: string;
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const supabase = await createClient();
  const created = await getSearchParam(searchParams, "created");
  const linked = await getSearchParam(searchParams, "linked");
  const error = await getSearchParam(searchParams, "error");

  const [{ data: projects }, { data: references }, { data: relationships }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id,title,summary,project_type,status")
        .order("created_at", { ascending: false })
        .returns<Project[]>(),
      supabase
        .from("references")
        .select("id,title,reference_type")
        .order("created_at", { ascending: false })
        .returns<ReferenceOption[]>(),
      supabase
        .from("relationships")
        .select("source_id,target_id")
        .eq("source_type", "reference")
        .eq("relationship_type", "related_to")
        .eq("target_type", "project")
        .returns<Relationship[]>(),
    ]);

  const referenceById = new Map((references ?? []).map((reference) => [reference.id, reference]));

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Work</p>
          <h1 className="page-title">Projects</h1>
          <p className="page-description">
            Create project records and connect existing references through relationships, keeping
            the Library as the single source of truth.
          </p>
        </div>
        <span className="status-pill">{projects?.length ?? 0} projects</span>
      </section>

      {created ? <p className="notice notice-success">Project created.</p> : null}
      {linked ? <p className="notice notice-success">Reference linked to project.</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}

      <section className="two-column">
        <div className="stack">
          <form action={createProject} className="panel form-stack">
            <p className="panel-kicker">Create</p>
            <h2 className="panel-title">New project</h2>
            <label className="field">
              <span>Title</span>
              <input name="title" required />
            </label>
            <label className="field">
              <span>Summary</span>
              <textarea name="summary" rows={4} />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Project type</span>
                <input name="project_type" />
              </label>
              <label className="field">
                <span>Status</span>
                <select name="status">
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                  <option value="complete">Complete</option>
                </select>
              </label>
            </div>
            <button className="button button-primary" type="submit">
              Save project
            </button>
          </form>

          <form action={linkReferenceToProject} className="panel form-stack">
            <p className="panel-kicker">Relationship</p>
            <h2 className="panel-title">Link reference to project</h2>
            <label className="field">
              <span>Project</span>
              <select name="project_id" required>
                <option value="">Select a project</option>
                {(projects ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Reference</span>
              <select name="reference_id" required>
                <option value="">Select a reference</option>
                {(references ?? []).map((reference) => (
                  <option key={reference.id} value={reference.id}>
                    {reference.title}
                  </option>
                ))}
              </select>
            </label>
            <button className="button" type="submit">
              Link reference
            </button>
          </form>
        </div>

        <section className="record-list" aria-label="Projects">
          {projects && projects.length > 0 ? (
            projects.map((project) => {
              const linkedReferences = (relationships ?? [])
                .filter((relationship) => relationship.target_id === project.id)
                .map((relationship) => referenceById.get(relationship.source_id))
                .filter(Boolean) as ReferenceOption[];

              return (
                <article className="record-card" key={project.id}>
                  <div className="record-card-header">
                    <span className="record-type">{project.project_type ?? "project"}</span>
                    <span className="record-date">{project.status ?? "active"}</span>
                  </div>
                  <h2>{project.title}</h2>
                  <p>{project.summary ?? "No project summary has been added yet."}</p>
                  {linkedReferences.length > 0 ? (
                    <ul className="simple-list">
                      {linkedReferences.map((reference) => (
                        <li key={reference.id}>
                          {reference.title} <span>({reference.reference_type})</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="record-meta">No references linked yet.</p>
                  )}
                </article>
              );
            })
          ) : (
            <div className="empty-state">
              <h2>No projects yet.</h2>
              <p>Create a project, then link existing references through relationships.</p>
            </div>
          )}
        </section>
      </section>
    </>
  );
}
