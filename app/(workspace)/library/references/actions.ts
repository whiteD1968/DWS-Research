"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFormValue, getOptionalFormValue, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function createReference(formData: FormData) {
  const user = await requireUser();
  const title = getFormValue(formData, "title");
  const referenceType = getFormValue(formData, "reference_type");

  if (!title || !referenceType) {
    redirect("/library/references?error=reference-required");
  }

  const supabase = await createClient();
  const sourceUrl = getOptionalFormValue(formData, "source_url");
  let primarySourceId: string | null = null;

  if (sourceUrl) {
    const { data: source, error: sourceError } = await supabase
      .from("sources")
      .insert({
        owner_id: user.id,
        source_type: "url",
        title,
        url: sourceUrl,
        creator: getOptionalFormValue(formData, "creator"),
      })
      .select("id")
      .single();

    if (sourceError || !source) {
      redirect(
        `/library/references?error=${encodeURIComponent(sourceError?.message ?? "Unable to create source")}`,
      );
    }

    primarySourceId = source.id;
  }

  const { data, error } = await supabase
    .from("references")
    .insert({
      owner_id: user.id,
      title,
      reference_type: referenceType,
      creator: getOptionalFormValue(formData, "creator"),
      project_name: getOptionalFormValue(formData, "project_name"),
      reference_date: getOptionalFormValue(formData, "reference_date"),
      location: getOptionalFormValue(formData, "location"),
      description: getOptionalFormValue(formData, "description"),
      why_saved: getOptionalFormValue(formData, "why_saved"),
      primary_source_id: primarySourceId,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/library/references?error=${encodeURIComponent(error?.message ?? "Unknown error")}`);
  }

  revalidatePath("/library");
  revalidatePath("/library/references");
  redirect(`/library/references/${data.id}?created=1`);
}
