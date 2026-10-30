import { timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { digestDue, digestParent, digestSettingsFrom } from "@/lib/digest";
import { gatherDigest, sendDigest, siteUrl } from "@/lib/digest-run";
import { scoutFor } from "@/lib/scout-run";
import { studioToday } from "@/lib/journal";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  return !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

// Vercel Cron calls this at 11:00 and 12:00 UTC; whichever is 7am in New York runs the scout and sends the email.
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = createServiceClient();
  if (!db) return Response.json({ error: "SUPABASE_SECRET_KEY is not set" }, { status: 503 });
  const now = new Date();
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
  return Response.json({ ran: now.toISOString(), results });
}
