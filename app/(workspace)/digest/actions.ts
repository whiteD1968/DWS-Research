"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { digestParent, digestSettingsFrom, parseEmail } from "@/lib/digest";
import { gatherDigest, sendDigest, siteUrl } from "@/lib/digest-run";

export async function saveDigestSettings(enabled: boolean, emailInput: string) {
  const email = parseEmail(emailInput);
  if (enabled && !email) throw new Error("Enter an email address.");
  const user = await requireUser(); const db = await createClient();
  const { data } = await db.from("notes").select("id,metadata").eq("owner_id", user.id).eq("parent_type", digestParent).order("created_at").limit(1).maybeSingle();
  const metadata = { ...((data?.metadata as object) || {}), enabled: enabled === true, email, last_error: null };
  const result = data
    ? await db.from("notes").update({ metadata }).eq("id", data.id).eq("owner_id", user.id)
    : await db.from("notes").insert({ owner_id: user.id, parent_type: digestParent, title: "Morning email", metadata });
  if (result.error) throw new Error("Could not save. Please retry.");
  revalidatePath("/");
  return digestSettingsFrom(metadata);
}

// Sends today's digest right away, even on a quiet day, so the setup can be checked.
export async function sendTestDigest(emailInput: string) {
  const email = parseEmail(emailInput);
  if (!email) throw new Error("Enter an email address.");
  const user = await requireUser(); const db = await createClient();
  const host = (await headers()).get("host");
  const digest = await gatherDigest(db, user.id, siteUrl(host ? `https://${host}` : ""), { quiet: true });
  if (!digest) throw new Error("Nothing to send.");
  await sendDigest(email, { ...digest, subject: `[Test] ${digest.subject}` });
}
