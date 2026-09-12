import Link from "next/link";
import { notFound } from "next/navigation";
import { updateReference } from "../../actions";
import { createClient } from "@/lib/supabase/server";
import { getSearchParam, type PageSearchParams } from "@/lib/search-params";

type ReferenceDetail = {
  id: string;
  title: string;
  reference_type: string;
  creator: string | null;
  project_name: string | null;
  reference_date: string | null;
  location: string | null;
  description: string | null;
  why_saved: string | null;
  primary_source_id: string | null;
};

type Source = {
  id: string;
  url: string | null;
};

export default async function EditReferencePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: PageSearchParams;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const error = await getSearchParam(searchParams, "error");

  const { data: reference } = await supabase
    .from("references")
    .select("*")
    .eq("id", id)
    .single<ReferenceDetail>();

  if (!reference) {
    notFound();
  }

  const { data: source } = reference.primary_source_id
    ? await supabase.from("sources").select("id,url").eq("id", reference.primary_source_id).single<Source>()
    : { data: null };

  return (
    <>
      <section className="breadcrumb-row">
        <Link href="/library/references">References</Link>
        <span>/</span>
        <Link href={`/library/references/${reference.id}`}>{reference.title}</Link>
        <span>/</span>
        <span>Edit</span>
      </section>

      <section className="page-header">
        <div>
          <p className="eyebrow">Edit reference</p>
          <h1 className="page-title">{reference.title}</h1>
        </div>
      </section>

      {error ? <p className="notice notice-error">{error}</p> : null}

      <form action={updateReference} className="panel form-stack edit-form">
        <input name="reference_id" type="hidden" value={reference.id} />
        <input name="primary_source_id" type="hidden" value={reference.primary_source_id ?? ""} />
        <label className="field">
          <span>Title</span>
          <input defaultValue={reference.title} name="title" required />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Reference type</span>
            <input defaultValue={reference.reference_type} name="reference_type" required />
          </label>
          <label className="field">
            <span>Creator</span>
            <input defaultValue={reference.creator ?? ""} name="creator" />
          </label>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Project name</span>
            <input defaultValue={reference.project_name ?? ""} name="project_name" />
          </label>
          <label className="field">
            <span>Reference date</span>
            <input defaultValue={reference.reference_date ?? ""} name="reference_date" />
          </label>
        </div>
        <label className="field">
          <span>Location</span>
          <input defaultValue={reference.location ?? ""} name="location" />
        </label>
        <label className="field">
          <span>Source URL</span>
          <input defaultValue={source?.url ?? ""} name="source_url" type="url" />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea defaultValue={reference.description ?? ""} name="description" rows={5} />
        </label>
        <label className="field">
          <span>Why saved</span>
          <textarea defaultValue={reference.why_saved ?? ""} name="why_saved" rows={4} />
        </label>
        <div className="detail-actions">
          <button className="button button-primary" type="submit">
            Save changes
          </button>
          <Link className="button" href={`/library/references/${reference.id}`}>
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
