import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { siteUrl } from "@/lib/digest-run";
import { authorizeUrl, pinterestCallbackPath, pinterestReady, pinterestStateCookie } from "@/lib/pinterest";

// Sends the browser to Pinterest's sign-in, with a one-time state checked when Pinterest sends it back.
export async function GET(request: NextRequest) {
  await requireUser();
  const base = siteUrl(request.nextUrl.origin);
  if (!pinterestReady()) return NextResponse.redirect(`${base}/library/pinterest?error=setup`);
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(authorizeUrl(process.env.PINTEREST_APP_ID!, `${base}${pinterestCallbackPath}`, state));
  response.cookies.set(pinterestStateCookie, state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/api/pinterest" });
  return response;
}
