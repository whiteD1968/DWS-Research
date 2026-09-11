import { addReferenceToCollection, createCollection } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { getSearchParam, type PageSearchParams } from "@/lib/search-params";

type Collection = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
};

type ReferenceOption = {
  id: string;
  title: string;
  reference_type: string;
};

type CollectionItem = {
  collection_id: string;
  record_id: string;
};

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const supabase = await createClient();
  const created = await getSearchParam(searchParams, "created");
  const linked = await getSearchParam(searchParams, "linked");
  const error = await getSearchParam(searchParams, "error");

  const [{ data: collections }, { data: references }, { data: collectionItems }] =
    await Promise.all([
      supabase
        .from("collections")
        .select("id,title,description,created_at")
        .order("created_at", { ascending: false })
        .returns<Collection[]>(),
      supabase
        .from("references")
        .select("id,title,reference_type")
        .order("created_at", { ascending: false })
        .returns<ReferenceOption[]>(),
      supabase
        .from("collection_items")
        .select("collection_id,record_id")
        .eq("record_type", "reference")
        .returns<CollectionItem[]>(),
    ]);

  const referenceById = new Map((references ?? []).map((reference) => [reference.id, reference]));

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Groups</p>
          <h1 className="page-title">Collections</h1>
          <p className="page-description">
            Curate saved references into reusable sets without duplicating the underlying
            reference records.
          </p>
        </div>
        <span className="status-pill">{collections?.length ?? 0} collections</span>
      </section>

      {created ? <p className="notice notice-success">Collection created.</p> : null}
      {linked ? <p className="notice notice-success">Reference added to collection.</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}

      <section className="two-column">
        <div className="stack">
          <form action={createCollection} className="panel form-stack">
            <p className="panel-kicker">Create</p>
            <h2 className="panel-title">New collection</h2>
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

          <form action={addReferenceToCollection} className="panel form-stack">
            <p className="panel-kicker">Link</p>
            <h2 className="panel-title">Add reference to collection</h2>
            <label className="field">
              <span>Collection</span>
              <select name="collection_id" required>
                <option value="">Select a collection</option>
                {(collections ?? []).map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Reference</span>
              <select name="reference_id" required>
                <option value="">Select a reference</option>
                {(references ?? []).map((reference) => (
                  <option key={reference.id} value={reference.id}>
                    {reference.title}
                  </option>
                ))}
              </select>
            </label>
            <button className="button" type="submit">
              Add to collection
            </button>
          </form>
        </div>

        <section className="record-list" aria-label="Collections">
          {collections && collections.length > 0 ? (
            collections.map((collection) => {
              const linkedReferences = (collectionItems ?? [])
                .filter((item) => item.collection_id === collection.id)
                .map((item) => referenceById.get(item.record_id))
                .filter(Boolean) as ReferenceOption[];

              return (
                <article className="record-card" key={collection.id}>
                  <h2>{collection.title}</h2>
                  <p>{collection.description ?? "No description has been added yet."}</p>
                  {linkedReferences.length > 0 ? (
                    <ul className="simple-list">
                      {linkedReferences.map((reference) => (
                        <li key={reference.id}>
                          {reference.title} <span>({reference.reference_type})</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="record-meta">No references linked yet.</p>
                  )}
                </article>
              );
            })
          ) : (
            <div className="empty-state">
              <h2>No collections yet.</h2>
              <p>Create a collection, then add existing references into it.</p>
            </div>
          )}
        </section>
      </section>
    </>
  );
}
