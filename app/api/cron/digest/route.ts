import { timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { digestDue, digestParent, digestSettingsFrom, isMorningRun } from "@/lib/digest";
import { zoteroParent } from "@/lib/zotero";
import { syncZoteroFor } from "@/lib/zotero-sync";
import { pinterestParent } from "@/lib/pinterest";
import { syncPinterestFor } from "@/lib/pinterest-sync";
import { gatherDigest, sendDigest, siteUrl } from "@/lib/digest-run";
import { scoutFor } from "@/lib/scout-run";
import { studioToday } from "@/lib/journal";
import { describeImagesFor, imageTaggingReady } from "@/lib/image-tagger";
import { undescribedFilter } from "@/lib/image-tags";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  return !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

// Vercel Cron calls this at 11:00 and 12:00 UTC; whichever is 7am in New York syncs Zotero and Pinterest, runs the scout, and sends the email.
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = createServiceClient();
  if (!db) return Response.json({ error: "SUPABASE_SECRET_KEY is not set" }, { status: 503 });
  const now = new Date();
  const synced: { owner: string; status: string }[] = [];
  if (isMorningRun(now)) {
    const { data: zoteroRows } = await db.from("notes").select("owner_id").eq("parent_type", zoteroParent).limit(100);
    for (const owner of new Set((zoteroRows || []).map(row => row.owner_id as string))) {
      try { const result = await syncZoteroFor(db, owner); synced.push({ owner, status: `added ${result.added}, updated ${result.updated}` }); }
      catch { synced.push({ owner, status: "failed" }); }
    }
    // Followed Pinterest boards bring in their newest pins before the email goes out.
    const { data: pinterestRows } = await db.from("notes").select("owner_id").eq("parent_type", pinterestParent).limit(100);
    for (const owner of new Set((pinterestRows || []).map(row => row.owner_id as string))) {
      try { const result = await syncPinterestFor(db, owner, Date.now() + 30000); synced.push({ owner, status: `pinterest added ${result.imported}` }); }
      catch { synced.push({ owner, status: "pinterest failed" }); }
    }
  }
  const { data, error } = await db.from("notes").select("id,owner_id,metadata").eq("parent_type", digestParent).eq("metadata->>enabled", "true").limit(100);
  if (error) return Response.json({ error: "Could not load digest settings" }, { status: 500 });
  const baseUrl = siteUrl(new URL(request.url).origin);
  const results: { owner: string; status: string }[] = [];
  for (const row of data || []) {
    const owner = row.owner_id as string;
    const settings = digestSettingsFrom(row.metadata);
    if (!digestDue(settings, now)) { results.push({ owner, status: "not due" }); continue; }
    // Claim the day first so an overlapping run can't send twice.
    await db.from("notes").update({ metadata: { ...(row.metadata as object), last_sent: studioToday(now) } }).eq("id", row.id).eq("owner_id", owner);
    try {
      if (process.env.BRAVE_SEARCH_API_KEY) await scoutFor(db, owner).catch(() => null);
      const digest = await gatherDigest(db, owner, baseUrl, { now });
      if (!digest) { results.push({ owner, status: "quiet" }); continue; }
      await sendDigest(settings.email, digest);
      results.push({ owner, status: "sent" });
    } catch (failure) {
      await db.from("notes").update({ metadata: { ...(row.metadata as object), last_sent: settings.lastSent, last_error: failure instanceof Error ? failure.message : "Failed" } }).eq("id", row.id).eq("owner_id", owner);
      results.push({ owner, status: "failed" });
    }
  }
  // Then images uploaded since yesterday get their captions and tags, within what's left of the run.
  const described: { owner: string; status: string }[] = [];
  if (isMorningRun(now) && imageTaggingReady()) {
    const { data: pending } = await db.from("media").select("owner_id").eq("media_type", "image").not("storage_path", "is", null).or(undescribedFilter).limit(500);
    for (const owner of new Set((pending || []).map(row => row.owner_id as string))) {
      if (Date.now() - now.getTime() > 80000) break;
      try { const result = await describeImagesFor(db, owner, { limit: 30, deadline: now.getTime() + 105000 }); described.push({ owner, status: `described ${result.described}, ${result.remaining} left` }); }
      catch { described.push({ owner, status: "failed" }); }
    }
  }
  return Response.json({ ran: now.toISOString(), zotero: synced, results, images: described });
}
