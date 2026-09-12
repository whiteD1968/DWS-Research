"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFormValue, getOptionalFormValue, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || crypto.randomUUID();
}

export async function createProject(formData: FormData) {
  const user = await requireUser();
  const title = getFormValue(formData, "title");

  if (!title) {
    redirect("/projects?error=project-title");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert({
    owner_id: user.id,
    title,
    slug: `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`,
    summary: getOptionalFormValue(formData, "summary"),
    project_type: getOptionalFormValue(formData, "project_type"),
    status: getOptionalFormValue(formData, "status") ?? "active",
  });

  if (error) {
    redirect(`/projects?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/projects");
  redirect("/projects?created=project");
}

export async function updateProject(formData: FormData) {
  await requireUser();
  const projectId = getFormValue(formData, "project_id");
  const title = getFormValue(formData, "title");

  if (!projectId || !title) {
    redirect("/projects?error=project-update-required");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      title,
      summary: getOptionalFormValue(formData, "summary"),
      project_type: getOptionalFormValue(formData, "project_type"),
      status: getOptionalFormValue(formData, "status") ?? "active",
      start_date: getOptionalFormValue(formData, "start_date"),
      end_date: getOptionalFormValue(formData, "end_date"),
    })
    .eq("id", projectId);

  if (error) {
    redirect(`/projects/${projectId}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?updated=project`);
}

export async function linkReferenceToProject(formData: FormData) {
  const user = await requireUser();
  const referenceId = getFormValue(formData, "reference_id");
  const projectId = getFormValue(formData, "project_id");
  const redirectTo = getOptionalFormValue(formData, "redirect_to");

  if (!referenceId || !projectId) {
    redirect("/projects?error=project-reference-required");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("relationships").upsert(
    {
      owner_id: user.id,
      source_type: "reference",
      source_id: referenceId,
      relationship_type: "related_to",
      target_type: "project",
      target_id: projectId,
    },
    {
      onConflict: "source_type,source_id,relationship_type,target_type,target_id",
    },
  );

  if (error) {
    redirect(`/projects?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/library/references");
  if (redirectTo) {
    redirect(`${redirectTo}?linked=project`);
  }

  redirect("/projects?linked=reference");
}
