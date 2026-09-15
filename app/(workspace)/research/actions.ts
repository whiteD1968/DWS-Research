"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, getFormValue } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { topicLinks, topicModes, topicStatuses, reviewFields, type TopicRecordType } from "@/lib/research";
import { researchTypes } from "@/lib/research-organization";

export async function manageTopic(form: FormData) {
  const user = await requireUser();
  const db = await createClient();
  let topicId = getFormValue(form, "topic_id");
  const mode = topicModes.includes(String(form.get("mode"))) ? String(form.get("mode")) : "overview";
  const op = getFormValue(form, "op");
  let errorMessage = "";
  async function owned(table: string, id: string | null) {
    if (!id) throw new Error("Choose a record.");
    const { data, error } = await db.from(table).select("*").eq("id", id).eq("owner_id", user.id).single();
    if (error || !data) throw new Error("Record unavailable.");
    return data;
  }
  function checked(result: { error: { message: string } | null }) { if (result.error) throw new Error("Unable to save the change. Please retry."); }
  try {
    if (op === "create" || op === "edit") {
      const title = getFormValue(form, "title");
      const status = getFormValue(form, "status") ?? "active";
      if (!title || title.length > 200 || !topicStatuses.includes(status)) throw new Error("Enter a title and valid status.");
      const values = { title, question: getFormValue(form, "question"), summary: getFormValue(form, "summary"), status };
      const researchType = getFormValue(form, "research_type") ?? "Other";
      const researchArea = getFormValue(form, "research_area");
      if (!researchTypes.includes(researchType) || (researchArea?.length ?? 0) > 160) throw new Error("Choose a valid Research Type and Area.");
      const organization = { research_area: researchArea, research_type: researchType };
      if (op === "create") {
        const { data, error } = await db.from("research_threads").insert({ ...values, metadata: organization, owner_id: user.id }).select("id").single();
        if (error || !data) throw new Error("Unable to create topic.");
        topicId = data.id;
      } else {
        const current = await owned("research_threads", topicId);
        checked(await db.from("research_threads").update({ ...values, metadata: { ...current.metadata, ...organization } }).eq("id", topicId).eq("owner_id", user.id));
      }
    } else {
      await owned("research_threads", topicId);
      if (op === "document-edit") {
        const link = await owned("relationships", getFormValue(form, "link_id"));
        if (link.source_type !== "research_thread" || link.source_id !== topicId || link.relationship_type !== "has_document" || link.target_type !== "media") throw new Error("Document link unavailable.");
        const media = await owned("media", link.target_id);
        const title = getFormValue(form, "title");
        if (!title || title.length > 200 || media.mime_type !== "application/pdf") throw new Error("Enter a document title.");
        checked(await db.from("media").update({ title, metadata: { ...media.metadata, document_type: getFormValue(form, "document_type") } }).eq("id", media.id).eq("owner_id", user.id));
        revalidatePath("/library");
      } else if (op === "link") {
        const type = getFormValue(form, "record_type") as TopicRecordType;
        if (!Object.hasOwn(topicLinks, type)) throw new Error("Unsupported record type.");
        const target = await owned(topicLinks[type].table, getFormValue(form, "record_id"));
        if (type === "media" && target.mime_type !== "application/pdf") throw new Error("Choose a PDF document.");
        checked(await db.from("relationships").upsert({ owner_id: user.id, source_type: "research_thread", source_id: topicId,
          relationship_type: topicLinks[type].relationship, target_type: type, target_id: target.id },
        { onConflict: "source_type,source_id,relationship_type,target_type,target_id", ignoreDuplicates: true }));
        if (type === "project") revalidatePath(`/projects/${target.id}`);
      } else if (op === "unlink" || op === "review" || op === "theme-edit") {
        const link = await owned("relationships", getFormValue(form, "link_id"));
        if (link.source_type !== "research_thread" || link.source_id !== topicId) throw new Error("Link does not belong to this topic.");
        if (op === "unlink") {
          if (["reference", "media", "project"].includes(link.target_type)) {
            const { data: themes, error } = await db.from("relationships").select("id").eq("owner_id", user.id).eq("source_type", "research_thread").eq("source_id", topicId).eq("relationship_type", "has_theme");
            checked({ error });
            if (themes?.length) checked(await db.from("relationships").delete().eq("owner_id", user.id).eq("source_type", "research_topic_theme").in("source_id", themes.map(theme => theme.id)).eq("target_type", link.target_type).eq("target_id", link.target_id));
          }
          if (link.relationship_type === "has_theme") checked(await db.from("relationships").delete().eq("owner_id", user.id).eq("source_type", "research_topic_theme").eq("source_id", link.id));
          checked(await db.from("relationships").delete().eq("id", link.id).eq("owner_id", user.id));
          if (link.target_type === "project") revalidatePath(`/projects/${link.target_id}`);
        } else if (op === "theme-edit") {
          if (link.relationship_type !== "has_theme") throw new Error("Theme unavailable.");
          checked(await db.from("relationships").update({ note: getFormValue(form, "description") }).eq("id", link.id).eq("owner_id", user.id));
        } else {
          if (!["has_reference", "has_document"].includes(link.relationship_type)) throw new Error("This item cannot have a literature review.");
          const status = getFormValue(form, "review_status") ?? "unreviewed";
          if (!["unreviewed", "included", "excluded", "key_source"].includes(status)) throw new Error("Invalid review status.");
          const review = Object.fromEntries(reviewFields.map(key => [key, getFormValue(form, key)]));
          checked(await db.from("relationships").update({ metadata: { ...link.metadata, ...review, review_status: status, reviewed_at: new Date().toISOString() } }).eq("id", link.id).eq("owner_id", user.id));
        }
      } else if (op === "note" || op === "note-delete") {
        const noteId = getFormValue(form, "note_id");
        if (noteId) {
          const note = await owned("notes", noteId);
          if (note.parent_type !== "research_thread" || note.parent_id !== topicId) throw new Error("Note unavailable.");
        }
        if (op === "note-delete") {
          if (!noteId) throw new Error("Choose a note.");
          checked(await db.from("relationships").delete().eq("owner_id", user.id).eq("target_type", "note").eq("target_id", noteId).eq("source_type", "research_topic_theme"));
          checked(await db.from("notes").delete().eq("id", noteId).eq("owner_id", user.id));
        } else {
          const values = { title: getFormValue(form, "title"), plain_text: getFormValue(form, "plain_text") };
          if (!values.plain_text) throw new Error("Enter note text.");
          // Rich content is retained on edits; plain_text is the current editing surface.
          if (noteId) checked(await db.from("notes").update(values).eq("id", noteId).eq("owner_id", user.id));
          else checked(await db.from("notes").insert({ ...values, owner_id: user.id, parent_type: "research_thread", parent_id: topicId, content: [] }));
        }
      } else if (op === "theme") {
        const name = getFormValue(form, "title");
        if (!name || name.length > 200) throw new Error("Enter a theme title.");
        const { data: tag, error } = await db.from("tags").upsert({ owner_id: user.id, name }, { onConflict: "owner_id,name" }).select("id").single();
        if (error || !tag) throw new Error("Unable to create theme.");
        checked(await db.from("relationships").upsert({ owner_id: user.id, source_type: "research_thread", source_id: topicId, relationship_type: "has_theme", target_type: "tag", target_id: tag.id, note: getFormValue(form, "description") }, { onConflict: "source_type,source_id,relationship_type,target_type,target_id", ignoreDuplicates: true }));
      } else if (op === "theme-link" || op === "theme-unlink") {
        const theme = await owned("relationships", getFormValue(form, "theme_id"));
        if (theme.source_type !== "research_thread" || theme.source_id !== topicId || theme.relationship_type !== "has_theme") throw new Error("Theme unavailable.");
        if (op === "theme-unlink") {
          checked(await db.from("relationships").delete().eq("id", getFormValue(form, "link_id")).eq("source_type", "research_topic_theme").eq("source_id", theme.id).eq("owner_id", user.id));
        } else {
          const [type, id] = (getFormValue(form, "record") ?? "").split(":");
          if (type === "note") {
            const note = await owned("notes", id);
            if (note.parent_type !== "research_thread" || note.parent_id !== topicId) throw new Error("Choose a topic note.");
          } else {
            if (!["reference", "media", "project"].includes(type)) throw new Error("Unsupported theme member.");
            await owned(topicLinks[type as TopicRecordType].table, id);
            const { data } = await db.from("relationships").select("id").eq("owner_id", user.id).eq("source_type", "research_thread").eq("source_id", topicId).eq("target_type", type).eq("target_id", id).eq("relationship_type", topicLinks[type as TopicRecordType].relationship).maybeSingle();
            if (!data) throw new Error("Link the record to this topic first.");
          }
          checked(await db.from("relationships").upsert({ owner_id: user.id, source_type: "research_topic_theme", source_id: theme.id, relationship_type: "includes", target_type: type, target_id: id }, { onConflict: "source_type,source_id,relationship_type,target_type,target_id", ignoreDuplicates: true }));
        }
      } else throw new Error("Unsupported action.");
      checked(await db.from("research_threads").update({ updated_at: new Date().toISOString() }).eq("id", topicId).eq("owner_id", user.id));
    }
  } catch (error) { errorMessage = error instanceof Error ? error.message : "Unable to save."; }
  revalidatePath("/research");
  if (topicId) revalidatePath(`/research/${topicId}`);
  redirect(`${topicId ? `/research/${topicId}?mode=${mode}` : "/research?"}${errorMessage ? `&error=${encodeURIComponent(errorMessage)}` : "&saved=1"}`);
}
