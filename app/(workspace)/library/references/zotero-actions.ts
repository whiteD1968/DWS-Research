"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseCollectionKey, parseZoteroKey, zoteroParent } from "@/lib/zotero";
import { syncZoteroFor } from "@/lib/zotero-sync";

// Checks the key with Zotero, which also tells us the user ID, so pasting the key is the whole setup.
export async function connectZotero(keyInput: string, collectionInput: string) {
  const apiKey = parseZoteroKey(keyInput);
  if (!apiKey) throw new Error("That doesn’t look like a Zotero API key. It’s 24 letters and numbers.");
  const collection = collectionInput.trim() ? parseCollectionKey(collectionInput) : "";
  if (collectionInput.trim() && !collection) throw new Error("A collection key is 8 letters and numbers, from the collection’s web address.");
  const response = await fetch("https://api.zotero.org/keys/current", { headers: { "Zotero-API-Key": apiKey, "Zotero-API-Version": "3" }, cache: "no-store", signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!response) throw new Error("Couldn’t reach Zotero. Please retry.");
  if (response.status === 403 || response.status === 404) throw new Error("Zotero doesn’t recognize that key.");
  if (!response.ok) throw new Error("Zotero didn’t answer. Please retry.");
  const info = await response.json() as { userID?: number; username?: string; access?: { user?: { library?: boolean } } };
  if (!info.userID) throw new Error("Zotero doesn’t recognize that key.");
  if (!info.access?.user?.library) throw new Error("That key can’t read your personal library. Turn on “Allow library access” for it at zotero.org.");

  const user = await requireUser(); const db = await createClient();
  const { data } = await db.from("notes").select("id,metadata").eq("owner_id", user.id).eq("parent_type", zoteroParent).order("created_at").limit(1).maybeSingle();
  const old = (data?.metadata || {}) as Record<string, unknown>;
  // A different account or collection starts from scratch; the same one keeps its place.
  const same = old.user_id === String(info.userID) && (old.collection || "") === collection;
  const metadata = { ...(same ? old : {}), user_id: String(info.userID), username: info.username || "", api_key: apiKey, collection, last_error: null };
  const result = data
    ? await db.from("notes").update({ metadata }).eq("owner_id", user.id).eq("id", data.id)
    : await db.from("notes").insert({ owner_id: user.id, parent_type: zoteroParent, title: "Zotero", metadata });
  if (result.error) throw new Error("Could not save. Please retry.");
  return syncZotero();
}

export async function syncZotero() {
  const user = await requireUser(); const db = await createClient();
  const result = await syncZoteroFor(db, user.id);
  revalidatePath("/library"); revalidatePath("/library/references");
  return result;
}

// Forgets the key. Imported references stay in the Library.
export async function disconnectZotero() {
  const user = await requireUser(); const db = await createClient();
  const { error } = await db.from("notes").delete().eq("owner_id", user.id).eq("parent_type", zoteroParent);
  if (error) throw new Error("Could not disconnect. Please retry.");
  revalidatePath("/library/references");
}
