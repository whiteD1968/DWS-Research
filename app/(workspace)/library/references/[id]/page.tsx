import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
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
  created_at: string;
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

  const { data: reference } = await supabase
    .from("references")
    .select("*")
    .eq("id", id)
    .single<ReferenceDetail>();

  if (!reference) {
    notFound();
  }

  const { data: collectionItems } = await supabase
    .from("collection_items")
    .select("collection_id")
    .eq("record_type", "reference")
    .eq("record_id", id)
    .returns<CollectionItem[]>();

  const collectionIds = collectionItems?.map((item) => item.collection_id) ?? [];
  const { data: collections } = collectionIds.length
    ? await supabase.from("collections").select("id,title").in("id", collectionIds).returns<Collection[]>()
    : { data: [] as Collection[] };

  const { data: relationships } = await supabase
    .from("relationships")
    .select("target_id")
    .eq("source_type", "reference")
    .eq("source_id", id)
    .eq("relationship_type", "related_to")
    .eq("target_type", "project")
    .returns<Relationship[]>();

  const projectIds = relationships?.map((relationship) => relationship.target_id) ?? [];
  const { data: projects } = projectIds.length
    ? await supabase.from("projects").select("id,title").in("id", projectIds).returns<Project[]>()
    : { data: [] as Project[] };

  const { data: source } = reference.primary_source_id
    ? await supabase
        .from("sources")
        .select("id,title,url")
        .eq("id", reference.primary_source_id)
        .single<Source>()
    : { data: null };

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Reference</p>
          <h1 className="page-title">{reference.title}</h1>
          <p className="page-description">
            {reference.description ?? reference.why_saved ?? "No description has been added yet."}
          </p>
        </div>
        <Link className="button" href="/library/references">
          Back to references
        </Link>
      </section>

      {created ? <p className="notice notice-success">Reference saved.</p> : null}

      <section className="two-column">
        <article className="panel detail-panel">
          <p className="panel-kicker">{reference.reference_type}</p>
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
              <dt>Source URL</dt>
              <dd>
                {source?.url ? (
                  <a href={source.url} rel="noreferrer" target="_blank">
                    {source.url}
                  </a>
                ) : (
                  "Not recorded"
                )}
              </dd>
            </div>
          </dl>
        </article>

        <section className="panel detail-panel">
          <p className="panel-kicker">Connected contexts</p>
          <h2 className="panel-title">Collections</h2>
          {collections && collections.length > 0 ? (
            <ul className="simple-list">
              {collections.map((collection) => (
                <li key={collection.id}>{collection.title}</li>
              ))}
            </ul>
          ) : (
            <p className="panel-copy">This reference is not in a collection yet.</p>
          )}

          <h2 className="panel-title spaced-title">Projects</h2>
          {projects && projects.length > 0 ? (
            <ul className="simple-list">
              {projects.map((project) => (
                <li key={project.id}>{project.title}</li>
              ))}
            </ul>
          ) : (
            <p className="panel-copy">This reference is not linked to a project yet.</p>
          )}
        </section>
      </section>
    </>
  );
}
