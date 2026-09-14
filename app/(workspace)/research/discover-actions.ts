"use server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { importDiscover } from "@/app/(workspace)/discover/actions";
import { revalidatePath } from "next/cache";

export async function addDiscoverToTopic(sessionId: string, ids: string[], existingId: string, title: string) {
  const user = await requireUser();
  const db = await createClient();
  let topicId = existingId;
  let savedItems: Record<string, string> = {};
  try {
    if (!Array.isArray(ids) || ids.length > 20) throw new Error("Select up to 20 results.");
    const { data: session, error: sessionError } = await db.from("research_sessions").select("id").eq("id", sessionId).eq("owner_id", user.id).single();
    if (sessionError || !session) throw new Error("Research session unavailable.");
    if (topicId) {
      const { data } = await db.from("research_threads").select("id").eq("id", topicId).eq("owner_id", user.id).single();
      if (!data) throw new Error("Research topic unavailable.");
    } else {
      if (!title.trim() || title.length > 200) throw new Error("Enter a topic title.");
      const { data, error } = await db.from("research_threads").insert({ owner_id: user.id, title: title.trim(), status: "active" }).select("id").single();
      if (error || !data) throw new Error("Unable to create topic.");
      topicId = data.id;
    }
    if (ids.length) {
      const imported = await importDiscover(sessionId, ids);
      if (imported.error) throw new Error(imported.error);
      savedItems = imported.savedItems ?? {};
    }
    const rows = [{ target_type: "research_session", target_id: sessionId, relationship_type: "has_discover_session" },
      ...[...new Set(Object.values(savedItems))].map(id => ({ target_type: "reference", target_id: id, relationship_type: "has_reference" }))]
      .map(row => ({ ...row, owner_id: user.id, source_type: "research_thread", source_id: topicId }));
    const { error } = await db.from("relationships").upsert(rows, { onConflict: "source_type,source_id,relationship_type,target_type,target_id", ignoreDuplicates: true });
    if (error) throw new Error("Topic links could not be saved. Imported references remain in your library; retry to finish linking.");
    const updated = await db.from("research_threads").update({ updated_at: new Date().toISOString() }).eq("id", topicId).eq("owner_id", user.id);
    if (updated.error) throw new Error("Records linked, but the topic date could not be updated.");
    revalidatePath("/research"); revalidatePath(`/research/${topicId}`);
    return { topicId, savedItems };
  } catch (error) { return { topicId, savedItems, error: error instanceof Error ? error.message : "Unable to add to topic." }; }
}
