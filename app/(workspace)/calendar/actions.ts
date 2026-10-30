"use server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/digest-run";
import { calendarParent, calendarTokenPattern, newCalendarToken } from "@/lib/calendar-feed";

async function feedToken(reset: boolean) {
  const user = await requireUser(); const db = await createClient();
  const { data, error } = await db.from("notes").select("id,metadata").eq("owner_id", user.id).eq("parent_type", calendarParent).order("created_at").limit(1).maybeSingle();
  if (error) throw new Error("Could not load your calendar link.");
  const existing = (data?.metadata as { token?: unknown } | undefined)?.token;
  if (!reset && typeof existing === "string" && calendarTokenPattern.test(existing)) return existing;
  const token = newCalendarToken();
  const result = data
    ? await db.from("notes").update({ metadata: { ...(data.metadata as object), token } }).eq("id", data.id).eq("owner_id", user.id)
    : await db.from("notes").insert({ owner_id: user.id, parent_type: calendarParent, title: "Calendar feed", metadata: { token } });
  if (result.error) throw new Error("Could not save your calendar link.");
  return token;
}

// The production address, so a link copied from a preview deployment still works in Outlook or Google.
const feedBase = () => siteUrl("");
// The private feed token, created the first time it's asked for.
export async function calendarFeedToken() { return { token: await feedToken(false), base: feedBase() }; }
// A new token stops every calendar subscribed with the old link.
export async function resetCalendarFeed() { return { token: await feedToken(true), base: feedBase() }; }
