import Link from "next/link";
import { notFound } from "next/navigation";
import { linkDocumentToReference, updateProjectDocumentDetails } from "@/app/(workspace)/projects/actions";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import { getSignedMediaUrl, type MediaRecord } from "@/lib/media";
import { getSearchParam, type PageSearchParams } from "@/lib/search-params";

type Project = {
  id: string;
  title: string;
};

type Relationship = {
  target_id: string;
};

type Reference = {
  id: string;
  title: string;
  reference_type: string;
  creator: string | null;
};

export default async function ProjectDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; mediaId: string }>;
  searchParams?: PageSearchParams;
}) {
  const { projectId, mediaId } = await params;
  const supabase = await createClient();
  const updated = await getSearchParam(searchParams, "updated");
  const linked = await getSearchParam(searchParams, "linked");
  const error = await getSearchParam(searchParams, "error");

  const [{ data: project }, { data: projectRelationship }, { data: document }] = await Promise.all([
    supabase.from("projects").select("id,title").eq("id", projectId).single<Project>(),
    supabase
      .from("relationships")
      .select("target_id")
      .eq("source_type", "project")
      .eq("source_id", projectId)
      .eq("relationship_type", "has_document")
      .eq("target_type", "media")
      .eq("target_id", mediaId)
      .single<Relationship>(),
    supabase
      .from("media")
      .select("id,title,bucket,storage_path,original_filename,mime_type,byte_size,caption,metadata,source_url,created_at")
      .eq("id", mediaId)
      .eq("media_type", "document")
      .single<MediaRecord>(),
  ]);

  if (!project || !projectRelationship || !document) {
    notFound();
  }

  const signedUrl = await getSignedMediaUrl(document);
  const { data: referenceRelationships } = await supabase
    .from("relationships")
    .select("target_id")
    .eq("source_type", "media")
    .eq("source_id", mediaId)
    .eq("relationship_type", "supports_reference")
    .eq("target_type", "reference")
    .returns<Relationship[]>();

  const linkedReferenceIds = referenceRelationships?.map((relationship) => relationship.target_id) ?? [];
  const [{ data: linkedReferences }, { data: allReferences }] = await Promise.all([
    linkedReferenceIds.length
      ? supabase
          .from("references")
          .select("id,title,reference_type,creator")
          .in("id", linkedReferenceIds)
          .returns<Reference[]>()
      : Promise.resolve({ data: [] as Reference[] }),
    supabase
      .from("references")
      .select("id,title,reference_type,creator")
      .order("updated_at", { ascending: false })
      .returns<Reference[]>(),
  ]);

  const linkedReferenceSet = new Set(linkedReferenceIds);
  const availableReferences = (allReferences ?? []).filter((reference) => !linkedReferenceSet.has(reference.id));

  return (
    <>
      <section className="breadcrumb-row">
        <Link href="/projects">Projects</Link>
        <span>/</span>
        <Link href={`/projects/${project.id}`}>{project.title}</Link>
        <span>/</span>
        <Link href={`/projects/${project.id}?mode=documents`}>Documents</Link>
        <span>/</span>
        <span>{document.title ?? document.original_filename ?? "Document"}</span>
      </section>

      {updated ? <p className="notice notice-success">Document updated.</p> : null}
      {linked ? <p className="notice notice-success">Reference linked to document.</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}

      <section className="page-header">
        <div>
          <p className="eyebrow">{getMetadataValue(document.metadata, "document_type") || "Project document"}</p>
          <h1 className="page-title">{document.title ?? document.original_filename ?? "Untitled document"}</h1>
          <p className="page-description">
            {getMetadataValue(document.metadata, "why_saved") || "A linked research PDF in this project dossier."}
          </p>
        </div>
        <div className="detail-actions">
          {signedUrl ? (
            <a className="button button-primary" href={signedUrl} rel="noreferrer" target="_blank">
              Open PDF
            </a>
          ) : null}
          <Link className="button" href={`/projects/${project.id}?mode=documents`}>
            Back to documents
          </Link>
        </div>
      </section>

      <section className="workspace-grid">
        <article className="panel detail-panel">
          <p className="panel-kicker">Document metadata</p>
          <dl className="detail-list">
            <div>
              <dt>Filename</dt>
              <dd>{document.original_filename ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Uploaded</dt>
              <dd>{document.created_at ? formatDate(document.created_at) : "Not recorded"}</dd>
            </div>
            <div>
              <dt>Author</dt>
              <dd>{getMetadataValue(document.metadata, "author") || "Not recorded"}</dd>
            </div>
            <div>
              <dt>Publication</dt>
              <dd>{getMetadataValue(document.metadata, "publication") || "Not recorded"}</dd>
            </div>
            <div>
              <dt>Published date</dt>
              <dd>{getMetadataValue(document.metadata, "published_date") || "Not recorded"}</dd>
            </div>
            <div>
              <dt>DOI</dt>
              <dd>{getMetadataValue(document.metadata, "doi") || "Not recorded"}</dd>
            </div>
            <div>
              <dt>Source URL</dt>
              <dd>
                {getMetadataValue(document.metadata, "source_url") || document.source_url ? (
                  <a href={getMetadataValue(document.metadata, "source_url") || (document.source_url ?? "")} rel="noreferrer" target="_blank">
                    {getMetadataValue(document.metadata, "source_url") || document.source_url}
                  </a>
                ) : (
                  "Not recorded"
                )}
              </dd>
            </div>
          </dl>
        </article>

        <form action={updateProjectDocumentDetails} className="panel form-stack">
          <p className="panel-kicker">Edit document</p>
          <input name="project_id" type="hidden" value={project.id} />
          <input name="media_id" type="hidden" value={document.id} />
          <input name="return_to" type="hidden" value={`/projects/${project.id}/documents/${document.id}`} />
          <label className="field">
            <span>Title</span>
            <input defaultValue={document.title ?? ""} name="title" />
          </label>
          <label className="field">
            <span>Author</span>
            <input defaultValue={getMetadataValue(document.metadata, "author")} name="author" />
          </label>
          <label className="field">
            <span>Publication</span>
            <input defaultValue={getMetadataValue(document.metadata, "publication")} name="publication" />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Published date</span>
              <input defaultValue={getMetadataValue(document.metadata, "published_date")} name="published_date" />
            </label>
            <label className="field">
              <span>DOI</span>
              <input defaultValue={getMetadataValue(document.metadata, "doi")} name="doi" />
            </label>
          </div>
          <label className="field">
            <span>Source URL</span>
            <input defaultValue={getMetadataValue(document.metadata, "source_url") || (document.source_url ?? "")} name="source_url" />
          </label>
          <label className="field">
            <span>Document type</span>
            <select defaultValue={getMetadataValue(document.metadata, "document_type")} name="document_type">
              <option value="">Unclassified</option>
              <option value="paper">Paper</option>
              <option value="book">Book</option>
              <option value="book_chapter">Book chapter</option>
              <option value="report">Report</option>
              <option value="thesis">Thesis</option>
              <option value="standard">Standard</option>
              <option value="manual">Manual</option>
              <option value="presentation">Presentation</option>
              <option value="scan">Scan</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="field">
            <span>Note / why this matters</span>
            <textarea defaultValue={getMetadataValue(document.metadata, "why_saved")} name="why_saved" rows={4} />
          </label>
          <button className="button button-primary" type="submit">
            Save document
          </button>
        </form>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Linked references</h2>
        </div>
        <div className="workspace-grid">
          <form action={linkDocumentToReference} className="panel form-stack">
            <p className="panel-kicker">Link reference</p>
            <input name="project_id" type="hidden" value={project.id} />
            <input name="media_id" type="hidden" value={document.id} />
            <input name="return_to" type="hidden" value={`/projects/${project.id}/documents/${document.id}`} />
            <label className="field">
              <span>Existing reference</span>
              <select name="reference_id" required>
                <option value="">Select a reference</option>
                {availableReferences.map((reference) => (
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
          <div className="document-reference-list">
            {(linkedReferences ?? []).length > 0 ? (
              (linkedReferences ?? []).map((reference) => (
                <Link className="visual-card compact-visual-card" href={`/library/references/${reference.id}`} key={reference.id}>
                  <div className="visual-card-body">
                    <div className="meta-row">
                      <span>{reference.reference_type}</span>
                      <span>{reference.creator ?? "Unknown"}</span>
                    </div>
                    <h2>{reference.title}</h2>
                  </div>
                </Link>
              ))
            ) : (
              <div className="empty-state">
                <h2>No linked references yet.</h2>
                <p>Link references that this document supports.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function getMetadataValue(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}
