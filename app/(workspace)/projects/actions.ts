"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFormValue, getOptionalFormValue, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  buildStoragePath,
  createMediaFromFile,
  getImageFiles,
  linkMediaToRecord,
} from "@/lib/media-upload";

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

export async function uploadProjectImages(formData: FormData) {
  const user = await requireUser();
  const projectId = getFormValue(formData, "project_id");
  const files = getImageFiles(formData);

  if (!projectId || files.length === 0) {
    redirect("/projects?error=image-required");
  }

  const supabase = await createClient();
  let firstMediaId: string | null = null;

  try {
    for (const [index, file] of files.entries()) {
      const mediaId = await createMediaFromFile({
        ownerId: user.id,
        file,
        storagePath: buildStoragePath({
          ownerId: user.id,
          recordType: "projects",
          recordId: projectId,
          fileName: file.name,
        }),
      });

      firstMediaId ??= mediaId;
      await linkMediaToRecord({
        ownerId: user.id,
        mediaId,
        recordType: "project",
        recordId: projectId,
        sortOrder: index,
      });
    }
  } catch (error) {
    redirect(`/projects/${projectId}?error=${encodeURIComponent(error instanceof Error ? error.message : "Upload failed")}`);
  }

  if (firstMediaId) {
    await supabase.from("projects").update({ cover_media_id: firstMediaId }).eq("id", projectId);
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?uploaded=images`);
}

export async function setProjectCoverMedia(formData: FormData) {
  await requireUser();
  const projectId = getFormValue(formData, "project_id");
  const mediaId = getFormValue(formData, "media_id");

  if (!projectId || !mediaId) {
    redirect("/projects?error=missing-media");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ cover_media_id: mediaId }).eq("id", projectId);

  if (error) {
    redirect(`/projects/${projectId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?updated=cover`);
}

export async function updateProjectDocumentDetails(formData: FormData) {
  await requireUser();
  const projectId = getFormValue(formData, "project_id");
  const mediaId = getFormValue(formData, "media_id");
  const returnTo = getOptionalFormValue(formData, "return_to") ?? (projectId ? `/projects/${projectId}?mode=documents` : "/projects");

  if (!projectId || !mediaId) {
    redirect("/projects?error=missing-document");
  }

  const metadata = {
    document_type: getOptionalFormValue(formData, "document_type"),
    author: getOptionalFormValue(formData, "author"),
    publication: getOptionalFormValue(formData, "publication"),
    published_date: getOptionalFormValue(formData, "published_date"),
    doi: getOptionalFormValue(formData, "doi"),
    source_url: getOptionalFormValue(formData, "source_url"),
    why_saved: getOptionalFormValue(formData, "why_saved"),
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("media")
    .update({
      title: getOptionalFormValue(formData, "title"),
      source_url: metadata.source_url,
      caption: metadata.why_saved,
      metadata,
    })
    .eq("id", mediaId)
    .eq("media_type", "document");

  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/documents/${mediaId}`);
  redirect(`${returnTo}?updated=document`);
}

export async function unlinkProjectDocument(formData: FormData) {
  await requireUser();
  const projectId = getFormValue(formData, "project_id");
  const mediaId = getFormValue(formData, "media_id");

  if (!projectId || !mediaId) {
    redirect("/projects?error=missing-document");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("relationships")
    .delete()
    .eq("source_type", "project")
    .eq("source_id", projectId)
    .eq("relationship_type", "has_document")
    .eq("target_type", "media")
    .eq("target_id", mediaId);

  if (error) {
    redirect(`/projects/${projectId}?mode=documents&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?mode=documents&removed=document`);
}

export async function linkDocumentToReference(formData: FormData) {
  const user = await requireUser();
  const projectId = getFormValue(formData, "project_id");
  const mediaId = getFormValue(formData, "media_id");
  const referenceId = getFormValue(formData, "reference_id");
  const returnTo = getOptionalFormValue(formData, "return_to") ?? (projectId ? `/projects/${projectId}/documents/${mediaId}` : "/projects");

  if (!mediaId || !referenceId) {
    redirect(`${returnTo}?error=missing-reference`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("relationships").upsert(
    {
      owner_id: user.id,
      source_type: "media",
      source_id: mediaId,
      relationship_type: "supports_reference",
      target_type: "reference",
      target_id: referenceId,
    },
    {
      onConflict: "source_type,source_id,relationship_type,target_type,target_id",
    },
  );

  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`);
  }

  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/documents/${mediaId}`);
  }

  redirect(`${returnTo}?linked=reference`);
}
export async function unlinkProjectReference(form: FormData) {
  const user = await requireUser();
  const projectId = getFormValue(form, "project_id");
  const referenceId = getFormValue(form, "reference_id");
  if (!projectId || !referenceId) redirect("/projects?error=Choose+a+reference");
  const db = await createClient();
  const { error } = await db.from("relationships").delete().eq("owner_id", user.id)
    .eq("source_type", "reference").eq("source_id", referenceId).eq("target_type", "project")
    .eq("target_id", projectId).eq("relationship_type", "related_to");
  if (error) redirect(`/projects/${projectId}?error=Could+not+unlink+reference`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/library/references/${referenceId}`);
  redirect(`/projects/${projectId}?removed=reference`);
}
