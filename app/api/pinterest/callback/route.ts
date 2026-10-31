import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/digest-run";
import { pinterestCallbackPath, pinterestParent, pinterestStateCookie, tokenSettings } from "@/lib/pinterest";
import { pinterestGet, requestToken } from "@/lib/pinterest-sync";

// Pinterest sends the browser back here with a code, which is swapped for tokens kept with the owner's settings.
export async function GET(request: NextRequest) {
  const user = await requireUser();
  const base = siteUrl(request.nextUrl.origin);
  const done = (query: string) => { const response = NextResponse.redirect(`${base}/library/pinterest?${query}`); response.cookies.delete({ name: pinterestStateCookie, path: "/api/pinterest" }); return response; };
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code) return done("error=declined");
  if (!state || state !== request.cookies.get(pinterestStateCookie)?.value) return done("error=state");
  try {
    const token = tokenSettings(await requestToken({ grant_type: "authorization_code", code, redirect_uri: `${base}${pinterestCallbackPath}` }));
    if (!token) return done("error=token");
    const account = await pinterestGet<{ username?: string }>(token.access_token, "/user_account").catch(() => ({ username: "" }));
    const db = await createClient();
    const metadata = { ...token, username: account.username || "", connected_at: new Date().toISOString() };
    const { data } = await db.from("notes").select("id").eq("owner_id", user.id).eq("parent_type", pinterestParent).limit(1).maybeSingle();
    const result = data
      ? await db.from("notes").update({ metadata }).eq("owner_id", user.id).eq("id", data.id)
      : await db.from("notes").insert({ owner_id: user.id, parent_type: pinterestParent, title: "Pinterest", metadata });
    if (result.error) return done("error=save");
    return done("connected=1");
  } catch { return done("error=token"); }
}
