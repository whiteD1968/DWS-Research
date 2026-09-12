import Link from "next/link";
import { notFound } from "next/navigation";
import { updateProject } from "../../actions";
import { createClient } from "@/lib/supabase/server";
import { getSearchParam, type PageSearchParams } from "@/lib/search-params";

type Project = {
  id: string;
  title: string;
  summary: string | null;
  project_type: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
};

export default async function EditProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: PageSearchParams;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const error = await getSearchParam(searchParams, "error");

  const { data: project } = await supabase
    .from("projects")
    .select("id,title,summary,project_type,status,start_date,end_date")
    .eq("id", id)
    .single<Project>();

  if (!project) {
    notFound();
  }

  return (
    <>
      <section className="breadcrumb-row">
        <Link href="/projects">Projects</Link>
        <span>/</span>
        <Link href={`/projects/${project.id}`}>{project.title}</Link>
        <span>/</span>
        <span>Edit</span>
      </section>

      <section className="page-header">
        <div>
          <p className="eyebrow">Edit project</p>
          <h1 className="page-title">{project.title}</h1>
        </div>
      </section>

      {error ? <p className="notice notice-error">{error}</p> : null}

      <form action={updateProject} className="panel form-stack edit-form">
        <input name="project_id" type="hidden" value={project.id} />
        <label className="field">
          <span>Title</span>
          <input defaultValue={project.title} name="title" required />
        </label>
        <label className="field">
          <span>Summary</span>
          <textarea defaultValue={project.summary ?? ""} name="summary" rows={5} />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Project type</span>
            <input defaultValue={project.project_type ?? ""} name="project_type" />
          </label>
          <label className="field">
            <span>Status</span>
            <select defaultValue={project.status ?? "active"} name="status">
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
              <option value="complete">Complete</option>
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Start date</span>
            <input defaultValue={project.start_date ?? ""} name="start_date" type="date" />
          </label>
          <label className="field">
            <span>End date</span>
            <input defaultValue={project.end_date ?? ""} name="end_date" type="date" />
          </label>
        </div>
        <div className="detail-actions">
          <button className="button button-primary" type="submit">
            Save changes
          </button>
          <Link className="button" href={`/projects/${project.id}`}>
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
