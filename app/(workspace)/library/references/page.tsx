import Link from "next/link";
import { createReference } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { getSignedMediaUrlMap, type MediaRecord } from "@/lib/media";
import { getSearchParam, type PageSearchParams } from "@/lib/search-params";

type ReferenceRecord = {
  id: string;
  title: string;
  reference_type: string;
  creator: string | null;
  project_name: string | null;
  why_saved: string | null;
  primary_media_id: string | null;
};

function excerpt(value: string | null) {
  if (!value) {
    return "No note yet.";
  }

  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

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
    .select("id,title,reference_type,creator,project_name,why_saved,primary_media_id")
    .order("updated_at", { ascending: false })
    .returns<ReferenceRecord[]>();

  const mediaIds = (references ?? [])
    .map((reference) => reference.primary_media_id)
    .filter(Boolean) as string[];

  const { data: media } = mediaIds.length
    ? await supabase
        .from("media")
        .select("id,bucket,storage_path,alt_text,caption")
        .in("id", mediaIds)
        .returns<MediaRecord[]>()
    : { data: [] as MediaRecord[] };

  const mediaById = new Map((media ?? []).map((item) => [item.id, item]));
  const signedUrls = await getSignedMediaUrlMap(media ?? []);

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Library</p>
          <h1 className="page-title">References</h1>
          <p className="page-description">
            A visual archive of precedents, images, sources, and saved observations.
          </p>
        </div>
        <span className="status-pill">{references?.length ?? 0} records</span>
      </section>

      {created ? <p className="notice notice-success">Reference saved.</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}

      <details className="panel disclosure-panel">
        <summary>Create reference</summary>
        <form action={createReference} className="form-stack nested-form">
          <label className="field">
            <span>Title</span>
            <input name="title" required />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Reference type</span>
              <select name="reference_type" required>
                <option value="">Select a type</option>
                <option value="precedent">Precedent</option>
                <option value="book">Book</option>
                <option value="article">Article</option>
                <option value="website">Website</option>
                <option value="image">Image</option>
                <option value="drawing">Drawing</option>
                <option value="case_study">Case study</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="field">
              <span>Creator</span>
              <input name="creator" />
            </label>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Project name</span>
              <input name="project_name" />
            </label>
            <label className="field">
              <span>Reference date</span>
              <input name="reference_date" />
            </label>
          </div>
          <label className="field">
            <span>Source URL</span>
            <input name="source_url" type="url" />
          </label>
          <label className="field">
            <span>Why saved</span>
            <textarea name="why_saved" rows={3} />
          </label>
          <button className="button button-primary" type="submit">
            Save reference
          </button>
        </form>
      </details>

      <section className="visual-grid reference-grid" aria-label="References">
        {references && references.length > 0 ? (
          references.map((reference) => {
            const mediaItem = reference.primary_media_id
              ? mediaById.get(reference.primary_media_id)
              : null;
            const imageUrl = mediaItem ? signedUrls.get(mediaItem.id) : null;

            return (
              <Link className="visual-card reference-card" href={`/library/references/${reference.id}`} key={reference.id}>
                <div className="image-frame reference-thumb">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={mediaItem?.alt_text ?? reference.title} src={imageUrl} />
                  ) : (
                    <span>{reference.reference_type}</span>
                  )}
                </div>
                <div className="visual-card-body">
                  <div className="meta-row">
                    <span>{reference.reference_type}</span>
                    <span>{reference.creator ?? "Unknown"}</span>
                  </div>
                  <h2>{reference.title}</h2>
                  {reference.project_name ? <p className="record-meta">{reference.project_name}</p> : null}
                  <p>{excerpt(reference.why_saved)}</p>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="empty-state wide-empty">
            <h2>No references yet.</h2>
            <p>Create your first reference to begin building the visual library.</p>
          </div>
        )}
      </section>
    </>
  );
}
