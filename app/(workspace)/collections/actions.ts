"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFormValue, getOptionalFormValue, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function createCollection(formData: FormData) {
  const user = await requireUser();
  const title = getFormValue(formData, "title");

  if (!title) {
    redirect("/collections?error=collection-title");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("collections").insert({
    owner_id: user.id,
    title,
    description: getOptionalFormValue(formData, "description"),
  });

  if (error) {
    redirect(`/collections?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/collections");
  redirect("/collections?created=collection");
}

export async function updateCollection(formData: FormData) {
  await requireUser();
  const collectionId = getFormValue(formData, "collection_id");
  const title = getFormValue(formData, "title");

  if (!collectionId || !title) {
    redirect("/collections?error=collection-update-required");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("collections")
    .update({
      title,
      description: getOptionalFormValue(formData, "description"),
    })
    .eq("id", collectionId);

  if (error) {
    redirect(`/collections/${collectionId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/collections");
  revalidatePath(`/collections/${collectionId}`);
  redirect(`/collections/${collectionId}?updated=collection`);
}

export async function addReferenceToCollection(formData: FormData) {
  const user = await requireUser();
  const collectionId = getFormValue(formData, "collection_id");
  const referenceId = getFormValue(formData, "reference_id");

  if (!collectionId || !referenceId) {
    redirect("/collections?error=collection-reference-required");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("collection_items").upsert(
    {
      owner_id: user.id,
      collection_id: collectionId,
      record_type: "reference",
      record_id: referenceId,
    },
    { onConflict: "collection_id,record_type,record_id" },
  );

  if (error) {
    redirect(`/collections/${collectionId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/collections");
  revalidatePath(`/collections/${collectionId}`);
  revalidatePath("/library/references");
  redirect(`/collections/${collectionId}?linked=reference`);
}

export async function removeReferenceFromCollection(formData: FormData) {
  await requireUser();
  const collectionId = getFormValue(formData, "collection_id");
  const referenceId = getFormValue(formData, "reference_id");

  if (!collectionId || !referenceId) {
    redirect("/collections?error=collection-reference-required");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("collection_items")
    .delete()
    .eq("collection_id", collectionId)
    .eq("record_type", "reference")
    .eq("record_id", referenceId);

  if (error) {
    redirect(`/collections/${collectionId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/collections");
  revalidatePath(`/collections/${collectionId}`);
  redirect(`/collections/${collectionId}?removed=reference`);
}

export async function setCollectionCover(formData: FormData) {
  await requireUser();
  const collectionId = getFormValue(formData, "collection_id");
  const mediaId = getFormValue(formData, "media_id");

  if (!collectionId || !mediaId) {
    redirect("/collections?error=missing-cover");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("collections")
    .update({ cover_media_id: mediaId })
    .eq("id", collectionId);

  if (error) {
    redirect(`/collections/${collectionId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/collections");
  revalidatePath(`/collections/${collectionId}`);
  redirect(`/collections/${collectionId}?updated=cover`);
}

export async function moveCollectionItem(formData: FormData) {
  await requireUser();
  const collectionId = getFormValue(formData, "collection_id");
  const referenceId = getFormValue(formData, "reference_id");
  const direction = getFormValue(formData, "direction");
  const currentOrder = Number(getFormValue(formData, "sort_order") ?? 0);

  if (!collectionId || !referenceId || !direction) {
    redirect("/collections?error=missing-order");
  }

  const supabase = await createClient();
  const nextOrder = direction === "up" ? currentOrder - 1 : currentOrder + 1;
  const { error } = await supabase
    .from("collection_items")
    .update({ sort_order: nextOrder })
    .eq("collection_id", collectionId)
    .eq("record_type", "reference")
    .eq("record_id", referenceId);

  if (error) {
    redirect(`/collections/${collectionId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/collections/${collectionId}`);
  redirect(`/collections/${collectionId}?updated=order`);
}
