import { externalImageReference } from "@/lib/discover/images";
import { CollectionBoardHandoff } from "@/components/board-handoff";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addReferenceToCollection,
  moveCollectionItem,
  removeReferenceFromCollection,
  setCollectionCover,
  updateCollection,
} from "../actions";
import { createClient } from "@/lib/supabase/server";
import { getSignedMediaUrlMap, type MediaRecord } from "@/lib/media";
import { getSearchParam, type PageSearchParams } from "@/lib/search-params";

type Collection = {
  id: string;
  title: string;
  description: string | null;
};

type CollectionItem = {
  record_id: string;
  sort_order: number | null;
};

type ReferenceRecord = {
  metadata?: Record<string, unknown>;
  id: string;
  title: string;
  reference_type: string;
  creator: string | null;
  primary_media_id: string | null;
};

export default async function CollectionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: PageSearchParams;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const linked = await getSearchParam(searchParams, "linked");
  const removed = await getSearchParam(searchParams, "removed");
  const updated = await getSearchParam(searchParams, "updated");
  const error = await getSearchParam(searchParams, "error");

  const { data: collection } = await supabase
    .from("collections")
    .select("id,title,description")
    .eq("id", id)
    .single<Collection>();

  if (!collection) {
    notFound();
  }

  const [{ data: items }, { data: allReferences }] = await Promise.all([
    supabase
      .from("collection_items")
      .select("record_id,sort_order")
      .eq("collection_id", id)
      .eq("record_type", "reference")
      .returns<CollectionItem[]>(),
    supabase
      .from("references")
      .select("id,title,reference_type,creator,primary_media_id,metadata")
      .order("updated_at", { ascending: false })
      .returns<ReferenceRecord[]>(),
  ]);

  const itemByReferenceId = new Map((items ?? []).map((item) => [item.record_id, item]));
  const linkedIds = new Set((items ?? []).map((item) => item.record_id));
  const references = (allReferences ?? [])
    .filter((reference) => linkedIds.has(reference.id))
    .sort(
      (a, b) =>
        (itemByReferenceId.get(a.id)?.sort_order ?? 0) -
        (itemByReferenceId.get(b.id)?.sort_order ?? 0),
    );
  const availableReferences = (allReferences ?? []).filter((reference) => !linkedIds.has(reference.id));
  const mediaIds = references
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
      <section className="breadcrumb-row">
        <Link href="/collections">Collections</Link>
        <span>/</span>
        <span>{collection.title}</span>
      </section>

      {linked ? <p className="notice notice-success">Reference added.</p> : null}
      {removed ? <p className="notice notice-success">Reference removed.</p> : null}
      {updated ? <p className="notice notice-success">Collection updated.</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}

      <section className="page-header">
        <div>
          <p className="eyebrow">Collection</p>
          <h1 className="page-title">{collection.title}</h1>
          <p className="page-description">{collection.description ?? "No collection description yet."}</p>
        </div>
        <span className="status-pill">{references.length} records</span>
      </section>

      <CollectionBoardHandoff id={collection.id} title={collection.title} records={references.map(r => ({ id: r.id, title: r.title }))} />
      <section className="workspace-grid">
        <form action={updateCollection} className="panel form-stack">
          <p className="panel-kicker">Edit collection</p>
          <input name="collection_id" type="hidden" value={collection.id} />
          <label className="field">
            <span>Title</span>
            <input defaultValue={collection.title} name="title" required />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea defaultValue={collection.description ?? ""} name="description" rows={4} />
          </label>
          <button className="button" type="submit">
            Save changes
          </button>
        </form>

        <form action={addReferenceToCollection} className="panel form-stack">
          <p className="panel-kicker">Add reference</p>
          <input name="collection_id" type="hidden" value={collection.id} />
          <label className="field">
            <span>Reference</span>
            <select name="reference_id" required>
              <option value="">Select a reference</option>
              {availableReferences.map((reference) => (
                <option key={reference.id} value={reference.id}>
                  {reference.title}
                </option>
              ))}
            </select>
          </label>
          <button className="button button-primary" type="submit">
            Add to collection
          </button>
        </form>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>References</h2>
        </div>
        <div className="visual-grid reference-grid">
          {references.length > 0 ? (
            references.map((reference) => {
              const mediaItem = reference.primary_media_id
                ? mediaById.get(reference.primary_media_id)
                : null;
              const imageUrl = (mediaItem ? signedUrls.get(mediaItem.id) : null) || externalImageReference(reference.metadata)?.thumbnail;

              return (
                <article className="visual-card reference-card" key={reference.id}>
                  <Link href={`/library/references/${reference.id}`}>
                    <div className="image-frame reference-thumb">
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img referrerPolicy="no-referrer" alt={mediaItem?.alt_text ?? reference.title} src={imageUrl} />
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
                    </div>
                  </Link>
                  <form action={removeReferenceFromCollection} className="card-action-row">
                    <input name="collection_id" type="hidden" value={collection.id} />
                    <input name="reference_id" type="hidden" value={reference.id} />
                    <button className="text-button" type="submit">
                      Remove
                    </button>
                  </form>
                  <div className="card-action-row split-actions">
                    <form action={moveCollectionItem}>
                      <input name="collection_id" type="hidden" value={collection.id} />
                      <input name="reference_id" type="hidden" value={reference.id} />
                      <input
                        name="sort_order"
                        type="hidden"
                        value={itemByReferenceId.get(reference.id)?.sort_order ?? 0}
                      />
                      <input name="direction" type="hidden" value="up" />
                      <button className="text-button" type="submit">
                        Up
                      </button>
                    </form>
                    <form action={moveCollectionItem}>
                      <input name="collection_id" type="hidden" value={collection.id} />
                      <input name="reference_id" type="hidden" value={reference.id} />
                      <input
                        name="sort_order"
                        type="hidden"
                        value={itemByReferenceId.get(reference.id)?.sort_order ?? 0}
                      />
                      <input name="direction" type="hidden" value="down" />
                      <button className="text-button" type="submit">
                        Down
                      </button>
                    </form>
                    {mediaItem ? (
                      <form action={setCollectionCover}>
                        <input name="collection_id" type="hidden" value={collection.id} />
                        <input name="media_id" type="hidden" value={mediaItem.id} />
                        <button className="text-button" type="submit">
                          Set cover
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-state wide-empty">
              <h2>No references in this collection yet.</h2>
              <p>Add existing references above to build the contact sheet.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
