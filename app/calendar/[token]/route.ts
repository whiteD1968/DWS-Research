import { createClient } from "@supabase/supabase-js";
import { calendarTokenPattern, feedEvents, toIcs, type FeedRow } from "@/lib/calendar-feed";

export const dynamic = "force-dynamic";

// Calendar apps poll this without signing in; the token in the path is the only key.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/i, "");
  if (!calendarTokenPattern.test(token)) return new Response("Not found", { status: 404 });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("calendar_feed", { feed_token: token });
  if (error) return new Response("Calendar unavailable", { status: 503, headers: { "Retry-After": "600" } });
  const rows = (data || []) as FeedRow[];
  if (!rows.some(row => row.kind === "feed")) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  return new Response(toIcs(feedEvents(rows, url.origin), url.host), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="dws-research.ics"', "Cache-Control": "private, max-age=300", "X-Robots-Tag": "noindex" },
  });
}
