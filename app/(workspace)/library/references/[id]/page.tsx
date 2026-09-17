import { externalImageReference } from "@/lib/discover/images";
import Link from "next/link";
import { notFound } from "next/navigation";
import { linkReferenceToProject } from "@/app/(workspace)/projects/actions";
import {
  setReferencePrimaryMedia,
  unlinkReferenceMedia,
  updateMediaDetails,
} from "../actions";
import { MediaLightbox } from "@/components/media-lightbox";
import { MediaUploadPanel } from "@/components/media-upload-panel";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import {
  getRelationshipSortOrder,
  getSignedMediaUrlMap,
  type MediaRecord,
  type MediaRelationship,
  type SignedMediaItem,
} from "@/lib/media";
import { getSearchParam, type PageSearchParams } from "@/lib/search-params";

type ReferenceDetail = {
  metadata?: Record<string, unknown>;
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
  primary_media_id: string | null;
  created_at: string;
  updated_at: string;
};

type CollectionItem = {
  collection_id: string;
};

type Collection = {
  id: string;
  title: string;
};

type Relationship = {
  target_id: string;
};

type Project = {
  id: string;
  title: string;
};

type Source = {
  id: string;
  url: string | null;
  title: string | null;
};

export default async function ReferenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: PageSearchParams;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const created = await getSearchParam(searchParams, "created");
  const updated = await getSearchParam(searchParams, "updated");
  const uploaded = await getSearchParam(searchParams, "uploaded");
  const error = await getSearchParam(searchParams, "error");

  const { data: reference } = await supabase
    .from("references")
    .select("*")
    .eq("id", id)
    .single<ReferenceDetail>();

  if (!reference) {
    notFound();
  }

  const external = externalImageReference(reference.metadata);
  const [
    { data: collectionItems },
    { data: relationships },
    { data: projectsForPicker },
    sourceResult,
    { data: mediaRelationships },
  ] = await Promise.all([
    supabase
      .from("collection_items")
      .select("collection_id")
      .eq("record_type", "reference")
      .eq("record_id", id)
      .returns<CollectionItem[]>(),
    supabase
      .from("relationships")
      .select("target_id")
      .eq("source_type", "reference")
      .eq("source_id", id)
      .eq("relationship_type", "related_to")
      .eq("target_type", "project")
      .returns<Relationship[]>(),
    supabase.from("projects").select("id,title").order("updated_at", { ascending: false }).returns<Project[]>(),
    reference.primary_source_id
      ? supabase.from("sources").select("id,title,url").eq("id", reference.primary_source_id).single<Source>()
      : Promise.resolve({ data: null }),
    supabase
      .from("relationships")
      .select("target_id,metadata")
      .eq("source_type", "reference")
      .eq("source_id", id)
      .eq("relationship_type", "has_media")
      .eq("target_type", "media")
      .returns<MediaRelationship[]>(),
  ]);

  const collectionIds = collectionItems?.map((item) => item.collection_id) ?? [];
  const { data: collections } = collectionIds.length
    ? await supabase.from("collections").select("id,title").in("id", collectionIds).returns<Collection[]>()
    : { data: [] as Collection[] };

  const projectIds = relationships?.map((relationship) => relationship.target_id) ?? [];
  const { data: projects } = projectIds.length
    ? await supabase.from("projects").select("id,title").in("id", projectIds).returns<Project[]>()
    : { data: [] as Project[] };

  const mediaIds = Array.from(
    new Set([
      ...((mediaRelationships ?? []).map((relationship) => relationship.target_id)),
      ...(reference.primary_media_id ? [reference.primary_media_id] : []),
    ]),
  );
  const { data: media } = mediaIds.length
    ? await supabase
        .from("media")
        .select("id,title,bucket,storage_path,original_filename,mime_type,byte_size,alt_text,caption,metadata")
        .in("id", mediaIds)
        .returns<MediaRecord[]>()
    : { data: [] as MediaRecord[] };

  const signedUrlMap = await getSignedMediaUrlMap(media ?? []);
  const relationshipByMediaId = new Map(
    (mediaRelationships ?? []).map((relationship) => [relationship.target_id, relationship]),
  );
  const mediaItems: SignedMediaItem[] = (media ?? [])
    .map((item) => ({
      ...item,
      signedUrl: signedUrlMap.get(item.id) ?? null,
      sortOrder: getRelationshipSortOrder(relationshipByMediaId.get(item.id) ?? { target_id: item.id, metadata: null }),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const primaryMedia =
    mediaItems.find((item) => item.id === reference.primary_media_id) ?? mediaItems[0] ?? null;

  return (
    <>
      <section className="breadcrumb-row">
        <Link href="/library">Library</Link>
        <span>/</span>
        <Link href="/library/references">References</Link>
        <span>/</span>
        <span>{reference.title}</span>
      </section>

      {created ? <p className="notice notice-success">Reference saved.</p> : null}
      {updated ? <p className="notice notice-success">Reference updated.</p> : null}
      {uploaded ? <p className="notice notice-success">Primary image uploaded.</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}

      <section className="workspace-hero reference-hero">
        <div className="image-frame hero-image">
          {primaryMedia?.signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={primaryMedia.alt_text ?? reference.title} src={primaryMedia.signedUrl} />
          ) : (
            <span>No primary image</span>
          )}
        </div>
        <div className="hero-copy">
          <p className="eyebrow">{reference.reference_type}</p>
          <h1 className="page-title">{reference.title}</h1>
          <p className="page-description">{reference.why_saved ?? reference.description ?? "No note yet."}</p>
          <div className="detail-actions">
            <Link className="button button-primary" href={`/library/references/${reference.id}/edit`}>
              Edit reference
            </Link>
            <Link className="button" href="/library/references">
              Back to references
            </Link>
          </div>
        </div>
      </section>

      <section className="two-column">
        <article className="panel detail-panel">
          <p className="panel-kicker">Reference details</p>
          <dl className="detail-list">
            <div>
              <dt>Creator</dt>
              <dd>{reference.creator ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Project name</dt>
              <dd>{reference.project_name ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Reference date</dt>
              <dd>{reference.reference_date ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{reference.location ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(reference.created_at)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDate(reference.updated_at)}</dd>
            </div>
            <div>
              <dt>Source URL</dt>
              <dd>
                {sourceResult.data?.url ? (
                  <a href={sourceResult.data.url} rel="noreferrer" target="_blank">
                    {sourceResult.data.url}
                  </a>
                ) : (
                  "Not recorded"
                )}
              </dd>
            </div>
          </dl>
        </article>

        <section className="stack">
          <MediaUploadPanel
            hasPrimaryImage={Boolean(reference.primary_media_id)}
            recordId={reference.id}
            recordKind="reference"
          />

          <form action={linkReferenceToProject} className="panel form-stack">
            <p className="panel-kicker">Project link</p>
            <input name="reference_id" type="hidden" value={reference.id} />
            <input name="redirect_to" type="hidden" value={`/library/references/${reference.id}`} />
            <label className="field">
              <span>Link to project</span>
              <select name="project_id" required>
                <option value="">Select a project</option>
                {(projectsForPicker ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>
            <button className="button" type="submit">
              Link reference
            </button>
          </form>
        </section>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Gallery media</h2>
          <span className="record-meta">{mediaItems.length} images</span>
        </div>
        <MediaLightbox items={mediaItems} />
        <div className="media-manage-grid">
          {mediaItems.map((item) => (
            <article className="panel media-edit-card" key={item.id}>
              <div className="meta-row">
                <span>{item.mime_type ?? "image"}</span>
                <span>{item.original_filename ?? "file"}</span>
              </div>
              <form action={updateMediaDetails} className="form-stack">
                <input name="media_id" type="hidden" value={item.id} />
                <input name="return_to" type="hidden" value={`/library/references/${reference.id}`} />
                <label className="field">
                  <span>Title</span>
                  <input defaultValue={item.title ?? ""} name="title" />
                </label>
                <label className="field">
                  <span>Caption</span>
                  <textarea defaultValue={item.caption ?? ""} name="caption" rows={2} />
                </label>
                <div className="form-grid">
                  <label className="field">
                    <span>Visual type</span>
                    <select defaultValue={(item.metadata?.visual_type as string | undefined) ?? ""} name="visual_type">
                      <option value="">Unclassified</option>
                      <option value="photograph">Photograph</option>
                      <option value="drawing">Drawing</option>
                      <option value="diagram">Diagram</option>
                      <option value="sketch">Sketch</option>
                      <option value="render">Render</option>
                      <option value="screenshot">Screenshot</option>
                      <option value="material">Material</option>
                      <option value="fabrication">Fabrication</option>
                      <option value="scan">Scan</option>
                      <option value="generated">Generated</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Drawing type</span>
                    <select defaultValue={(item.metadata?.drawing_type as string | undefined) ?? ""} name="drawing_type">
                      <option value="">None</option>
                      <option value="plan">Plan</option>
                      <option value="section">Section</option>
                      <option value="elevation">Elevation</option>
                      <option value="axonometric">Axonometric</option>
                      <option value="detail">Detail</option>
                      <option value="diagram">Diagram</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                </div>
                <button className="button" type="submit">
                  Save media
                </button>
              </form>
              <div className="inline-actions">
                <form action={setReferencePrimaryMedia}>
                  <input name="reference_id" type="hidden" value={reference.id} />
                  <input name="media_id" type="hidden" value={item.id} />
                  <button className="text-button" type="submit">
                    Set as cover
                  </button>
                </form>
                <form action={unlinkReferenceMedia}>
                  <input name="reference_id" type="hidden" value={reference.id} />
                  <input name="media_id" type="hidden" value={item.id} />
                  <button className="text-button" type="submit">
                    Unlink
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>

      {external && <section className="panel section-block"><h2>Image reference</h2>
        {/* eslint-disable-next-line @next/next/no-img-element -- External image reference preview. */}
        {external.thumbnail && <img src={external.thumbnail} alt={reference.title} loading="lazy" referrerPolicy="no-referrer" style={{ maxWidth: "100%", maxHeight: 520, objectFit: "contain" }} />}
        <p>This is a linked image preview. The original remains on its source website.</p><div className="inline-actions">{external.source && <a href={external.source} target="_blank" rel="noopener noreferrer">Source page ↗</a>}{external.image && <a href={external.image} target="_blank" rel="noopener noreferrer">Original image ↗</a>}</div>
      </section>}
      <section className="workspace-grid section-block">
        <article className="panel detail-panel">
          <p className="panel-kicker">Description</p>
          <p className="panel-copy">{reference.description ?? "No description has been added yet."}</p>
        </article>
        <article className="panel detail-panel">
          <p className="panel-kicker">Why saved</p>
          <p className="panel-copy">{reference.why_saved ?? "No reason has been recorded yet."}</p>
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Connected contexts</h2>
        </div>
        <div className="workspace-grid">
          <article className="panel">
            <p className="panel-kicker">Collections</p>
            {collections && collections.length > 0 ? (
              <ul className="simple-list">
                {collections.map((collection) => (
                  <li key={collection.id}>
                    <Link href={`/collections/${collection.id}`}>{collection.title}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-copy">This reference is not in a collection yet.</p>
            )}
          </article>
          <article className="panel">
            <p className="panel-kicker">Projects</p>
            {projects && projects.length > 0 ? (
              <ul className="simple-list">
                {projects.map((project) => (
                  <li key={project.id}>
                    <Link href={`/projects/${project.id}`}>{project.title}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-copy">This reference is not linked to a project yet.</p>
            )}
          </article>
        </div>
      </section>
    </>
  );
}
