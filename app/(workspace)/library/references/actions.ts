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
      source_url: getOptionalFormValue(formData, "source_url"),
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
