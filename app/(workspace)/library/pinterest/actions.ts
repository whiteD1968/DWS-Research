"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { feedFromInput } from "@/lib/pinterest";
import { fetchFeed, pinterestSettings, saveFeeds, syncFeed } from "@/lib/pinterest-sync";

// Production hides the text of errors thrown by server actions, so failures come back as values the page can show.
async function safely<T>(work: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try { return { ok: true, value: await work() }; }
  catch (problem) { return { ok: false, error: problem instanceof Error ? problem.message : "Something went wrong. Please retry." }; }
}

// Checks the board's feed works before following it, then imports what it has.
export async function followBoard(input: string) { return safely(async () => {
  const feed = feedFromInput(input);
  if (!feed) throw new Error("Paste a Pinterest board link, like pinterest.com/yourname/board-name/, or your username.");
  const user = await requireUser(); const db = await createClient();
  const { title, pins } = await fetchFeed(feed.url);
  const feeds = (await pinterestSettings(db, user.id))?.feeds || [];
  if (!feeds.some(item => item.url === feed.url)) await saveFeeds(db, user.id, [...feeds, { ...feed, label: title || feed.label }]);
  const result = pins.length ? await syncFeed(db, user.id, feed.url) : null;
  revalidatePath("/library/pinterest"); revalidatePath("/library");
  return { title: title || feed.label, found: pins.length, imported: result?.imported ?? 0, failed: result?.failed ?? 0, reason: result?.reason ?? "" };
}); }

export async function syncBoard(url: string) { return safely(async () => {
  const user = await requireUser(); const db = await createClient();
  const result = await syncFeed(db, user.id, String(url));
  revalidatePath("/library/pinterest"); revalidatePath("/library");
  return result;
}); }

// Stops following a board. Its images and Collection stay in the Library.
export async function unfollowBoard(url: string) { return safely(async () => {
  const user = await requireUser(); const db = await createClient();
  const feeds = (await pinterestSettings(db, user.id))?.feeds || [];
  await saveFeeds(db, user.id, feeds.filter(item => item.url !== url));
  revalidatePath("/library/pinterest");
}); }
