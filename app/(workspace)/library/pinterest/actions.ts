"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { feedFromInput } from "@/lib/pinterest";
import { fetchFeed, pinterestSettings, saveFeeds, syncFeed } from "@/lib/pinterest-sync";

// Checks the board's feed works before following it, then imports what it has.
export async function followBoard(input: string) {
  const feed = feedFromInput(input);
  if (!feed) throw new Error("Paste a Pinterest board link, like pinterest.com/yourname/board-name/, or your username.");
  const user = await requireUser(); const db = await createClient();
  const { title, pins } = await fetchFeed(feed.url);
  const feeds = (await pinterestSettings(db, user.id))?.feeds || [];
  if (!feeds.some(item => item.url === feed.url)) await saveFeeds(db, user.id, [...feeds, { ...feed, label: title || feed.label }]);
  const result = pins.length ? await syncFeed(db, user.id, feed.url) : null;
  revalidatePath("/library/pinterest"); revalidatePath("/library");
  return { title: title || feed.label, found: pins.length, imported: result?.imported ?? 0 };
}

export async function syncBoard(url: string) {
  const user = await requireUser(); const db = await createClient();
  const result = await syncFeed(db, user.id, String(url));
  revalidatePath("/library/pinterest"); revalidatePath("/library");
  return result;
}

// Stops following a board. Its images and Collection stay in the Library.
export async function unfollowBoard(url: string) {
  const user = await requireUser(); const db = await createClient();
  const feeds = (await pinterestSettings(db, user.id))?.feeds || [];
  await saveFeeds(db, user.id, feeds.filter(item => item.url !== url));
  revalidatePath("/library/pinterest");
}
