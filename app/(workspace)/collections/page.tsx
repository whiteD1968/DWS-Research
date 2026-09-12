import Link from "next/link";
import { createCollection } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { getSignedMediaUrlMap, type MediaRecord } from "@/lib/media";
import { getSearchParam, type PageSearchParams } from "@/lib/search-params";

type Collection = {
  id: string;
  title: string;
  description: string | null;
  cover_media_id: string | null;
};

type CollectionItem = {
  collection_id: string;
  record_id: string;
};

type ReferenceRecord = {
  id: string;
  primary_media_id: string | null;
};

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const supabase = await createClient();
  const created = await getSearchParam(searchParams, "created");
  const error = await getSearchParam(searchParams, "error");

  const [{ data: collections }, { data: collectionItems }, { data: references }] =
    await Promise.all([
      supabase
        .from("collections")
        .select("id,title,description,cover_media_id")
        .order("updated_at", { ascending: false })
        .returns<Collection[]>(),
      supabase
        .from("collection_items")
        .select("collection_id,record_id")
        .eq("record_type", "reference")
        .returns<CollectionItem[]>(),
      supabase.from("references").select("id,primary_media_id").returns<ReferenceRecord[]>(),
    ]);

  const referenceById = new Map((references ?? []).map((reference) => [reference.id, reference]));
  const countByCollection = new Map<string, number>();
  const fallbackCoverByCollection = new Map<string, string>();

  for (const item of collectionItems ?? []) {
    countByCollection.set(item.collection_id, (countByCollection.get(item.collection_id) ?? 0) + 1);
    const reference = referenceById.get(item.record_id);
    if (reference?.primary_media_id && !fallbackCoverByCollection.has(item.collection_id)) {
      fallbackCoverByCollection.set(item.collection_id, reference.primary_media_id);
    }
  }

  const mediaIds = Array.from(
    new Set(
      (collections ?? [])
        .map((collection) => collection.cover_media_id ?? fallbackCoverByCollection.get(collection.id))
        .filter(Boolean) as string[],
    ),
  );

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
          <p className="eyebrow">Groups</p>
          <h1 className="page-title">Collections</h1>
          <p className="page-description">
            Visual research sets assembled from saved references without duplicating source records.
          </p>
        </div>
        <span className="status-pill">{collections?.length ?? 0} collections</span>
      </section>

      {created ? <p className="notice notice-success">Collection created.</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}

      <details className="panel disclosure-panel">
        <summary>Create collection</summary>
        <form action={createCollection} className="form-stack nested-form">
          <label className="field">
            <span>Title</span>
            <input name="title" required />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea name="description" rows={4} />
          </label>
          <button className="button button-primary" type="submit">
            Save collection
          </button>
        </form>
      </details>

      <section className="visual-grid collections-grid" aria-label="Collections">
        {collections && collections.length > 0 ? (
          collections.map((collection) => {
            const coverId = collection.cover_media_id ?? fallbackCoverByCollection.get(collection.id);
            const cover = coverId ? mediaById.get(coverId) : null;
            const coverUrl = cover ? signedUrls.get(cover.id) : null;

            return (
              <Link className="visual-card collection-card" href={`/collections/${collection.id}`} key={collection.id}>
                <div className="image-frame collection-thumb">
                  {coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={cover?.alt_text ?? collection.title} src={coverUrl} />
                  ) : (
                    <span>{countByCollection.get(collection.id) ?? 0} records</span>
                  )}
                </div>
                <div className="visual-card-body">
                  <div className="meta-row">
                    <span>{countByCollection.get(collection.id) ?? 0} records</span>
                  </div>
                  <h2>{collection.title}</h2>
                  <p>{collection.description ?? "No description has been added yet."}</p>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="empty-state wide-empty">
            <h2>No collections yet.</h2>
            <p>Create your first collection to group references into a visual research set.</p>
          </div>
        )}
      </section>
    </>
  );
}
