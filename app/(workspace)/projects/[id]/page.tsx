import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import { getSignedMediaUrl, type MediaRecord } from "@/lib/media";
import { getSearchParam, type PageSearchParams } from "@/lib/search-params";

type Project = {
  id: string;
  title: string;
  summary: string | null;
  project_type: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  updated_at: string;
  cover_media_id: string | null;
};

type Relationship = {
  source_id: string;
};

type Reference = {
  id: string;
  title: string;
  reference_type: string;
  creator: string | null;
  primary_media_id: string | null;
};

type CollectionItem = {
  collection_id: string;
  record_id: string;
};

type Collection = {
  id: string;
  title: string;
  description: string | null;
};

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: PageSearchParams;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const updated = await getSearchParam(searchParams, "updated");

  const { data: project } = await supabase
    .from("projects")
    .select("id,title,summary,project_type,status,start_date,end_date,updated_at,cover_media_id")
    .eq("id", id)
    .single<Project>();

  if (!project) {
    notFound();
  }

  const { data: relationships } = await supabase
    .from("relationships")
    .select("source_id")
    .eq("source_type", "reference")
    .eq("relationship_type", "related_to")
    .eq("target_type", "project")
    .eq("target_id", id)
    .returns<Relationship[]>();

  const referenceIds = relationships?.map((relationship) => relationship.source_id) ?? [];
  const { data: references } = referenceIds.length
    ? await supabase
        .from("references")
        .select("id,title,reference_type,creator,primary_media_id")
        .in("id", referenceIds)
        .returns<Reference[]>()
    : { data: [] as Reference[] };

  const { data: collectionItems } = referenceIds.length
    ? await supabase
        .from("collection_items")
        .select("collection_id,record_id")
        .eq("record_type", "reference")
        .in("record_id", referenceIds)
        .returns<CollectionItem[]>()
    : { data: [] as CollectionItem[] };

  const collectionIds = Array.from(new Set((collectionItems ?? []).map((item) => item.collection_id)));
  const { data: collections } = collectionIds.length
    ? await supabase
        .from("collections")
        .select("id,title,description")
        .in("id", collectionIds)
        .returns<Collection[]>()
    : { data: [] as Collection[] };

  const { data: coverMedia } = project.cover_media_id
    ? await supabase
        .from("media")
        .select("id,bucket,storage_path,alt_text,caption")
        .eq("id", project.cover_media_id)
        .single<MediaRecord>()
    : { data: null };

  const coverUrl = await getSignedMediaUrl(coverMedia);

  return (
    <>
      <section className="breadcrumb-row">
        <Link href="/projects">Projects</Link>
        <span>/</span>
        <span>{project.title}</span>
      </section>

      {updated ? <p className="notice notice-success">Project updated.</p> : null}

      <section className="workspace-hero">
        <div className="hero-copy">
          <p className="eyebrow">{project.project_type ?? "Project"}</p>
          <h1 className="page-title">{project.title}</h1>
          <p className="page-description">{project.summary ?? "No project summary yet."}</p>
          <div className="detail-actions">
            <Link className="button button-primary" href={`/projects/${project.id}/edit`}>
              Edit project
            </Link>
            <span className="status-pill">{project.status ?? "active"}</span>
          </div>
        </div>
        <div className="image-frame hero-image">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={coverMedia?.alt_text ?? project.title} src={coverUrl} />
          ) : (
            <span>No cover image</span>
          )}
        </div>
      </section>

      <section className="workspace-grid">
        <article className="panel detail-panel">
          <p className="panel-kicker">Project details</p>
          <dl className="detail-list">
            <div>
              <dt>Status</dt>
              <dd>{project.status ?? "active"}</dd>
            </div>
            <div>
              <dt>Start date</dt>
              <dd>{project.start_date ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>End date</dt>
              <dd>{project.end_date ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDate(project.updated_at)}</dd>
            </div>
          </dl>
        </article>

        <article className="panel detail-panel">
          <p className="panel-kicker">Notes</p>
          <h2 className="panel-title">Working notes</h2>
          <p className="panel-copy">Notes editing will be added after the core project and reference workspace is stable.</p>
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Linked references</h2>
          <Link className="button" href="/library/references">
            Browse references
          </Link>
        </div>
        <div className="visual-grid">
          {references && references.length > 0 ? (
            references.map((reference) => (
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
            <div className="empty-state wide-empty">
              <h2>No references linked yet.</h2>
              <p>Link references from the Projects index or reference detail workflow.</p>
            </div>
          )}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Linked collections</h2>
        </div>
        <div className="visual-grid collections-grid">
          {collections && collections.length > 0 ? (
            collections.map((collection) => (
              <Link className="visual-card compact-visual-card" href={`/collections/${collection.id}`} key={collection.id}>
                <div className="visual-card-body">
                  <h2>{collection.title}</h2>
                  <p>{collection.description ?? "No collection description yet."}</p>
                </div>
              </Link>
            ))
          ) : (
            <div className="empty-state wide-empty">
              <h2>No linked collections yet.</h2>
              <p>Collections will appear here when they contain references linked to this project.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
