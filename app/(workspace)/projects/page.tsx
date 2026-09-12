import Link from "next/link";
import { createProject } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import { getSignedMediaUrlMap, type MediaRecord } from "@/lib/media";
import { getSearchParam, type PageSearchParams } from "@/lib/search-params";

type Project = {
  id: string;
  title: string;
  summary: string | null;
  project_type: string | null;
  status: string | null;
  updated_at: string;
  cover_media_id: string | null;
};

type CoverMedia = MediaRecord;

function excerpt(value: string | null, fallback: string) {
  if (!value) {
    return fallback;
  }

  return value.length > 150 ? `${value.slice(0, 147)}...` : value;
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const supabase = await createClient();
  const created = await getSearchParam(searchParams, "created");
  const error = await getSearchParam(searchParams, "error");

  const { data: projects } = await supabase
    .from("projects")
    .select("id,title,summary,project_type,status,updated_at,cover_media_id")
    .order("updated_at", { ascending: false })
    .returns<Project[]>();

  const coverIds = (projects ?? [])
    .map((project) => project.cover_media_id)
    .filter(Boolean) as string[];

  const { data: media } = coverIds.length
    ? await supabase
        .from("media")
        .select("id,bucket,storage_path,alt_text,caption")
        .in("id", coverIds)
        .returns<CoverMedia[]>()
    : { data: [] as CoverMedia[] };

  const mediaById = new Map((media ?? []).map((item) => [item.id, item]));
  const signedUrls = await getSignedMediaUrlMap(media ?? []);

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Work</p>
          <h1 className="page-title">Projects</h1>
          <p className="page-description">
            Browse active research spaces, then open a project to edit its brief, dates, and linked
            references.
          </p>
        </div>
        <span className="status-pill">{projects?.length ?? 0} projects</span>
      </section>

      {created ? <p className="notice notice-success">Project created.</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}

      <section className="workspace-grid compact-create">
        <form action={createProject} className="panel form-stack">
          <p className="panel-kicker">Create</p>
          <h2 className="panel-title">New project</h2>
          <label className="field">
            <span>Title</span>
            <input name="title" required />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Type</span>
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
          <label className="field">
            <span>Short summary</span>
            <textarea name="summary" rows={3} />
          </label>
          <button className="button button-primary" type="submit">
            Save project
          </button>
        </form>

        <div className="panel quiet-panel">
          <p className="panel-kicker">Workspace</p>
          <p className="panel-copy">
            Project cards open into focused workspaces for editing project metadata and reviewing
            linked references and collections.
          </p>
        </div>
      </section>

      <section className="visual-grid projects-grid" aria-label="Projects">
        {projects && projects.length > 0 ? (
          projects.map((project) => {
            const cover = project.cover_media_id ? mediaById.get(project.cover_media_id) : null;
            const coverUrl = cover ? signedUrls.get(cover.id) : null;

            return (
              <Link className="visual-card project-card" href={`/projects/${project.id}`} key={project.id}>
                <div className="image-frame project-thumb">
                  {coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={cover?.alt_text ?? project.title} src={coverUrl} />
                  ) : (
                    <span>{project.project_type ?? "Project"}</span>
                  )}
                </div>
                <div className="visual-card-body">
                  <div className="meta-row">
                    <span>{project.project_type ?? "Project"}</span>
                    <span>{project.status ?? "active"}</span>
                  </div>
                  <h2>{project.title}</h2>
                  <p>{excerpt(project.summary, "No project summary yet.")}</p>
                  <p className="record-meta">Updated {formatDate(project.updated_at)}</p>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="empty-state wide-empty">
            <h2>No projects yet.</h2>
            <p>Create your first project to begin collecting references, dates, and research notes.</p>
          </div>
        )}
      </section>
    </>
  );
}
