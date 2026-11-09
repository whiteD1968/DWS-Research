import sharp from "sharp";
import { requireUser } from "@/lib/auth";
import { chromeExtensionFiles } from "@/lib/chrome-extension";
import { zipFiles } from "@/lib/zip";

// Downloads the Chrome extension, pointed at this site's own address.
export async function GET(request: Request) {
  await requireUser();
  const origin = new URL(request.url).origin;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const site = forwardedHost ? `${request.headers.get("x-forwarded-proto") || "https"}://${forwardedHost}` : origin;
  let icons: { size: number; data: Uint8Array }[] = [];
  try {
    const response = await fetch(new URL("/icons/icon-192.png", site), { cache: "no-store" });
    if (response.ok) {
      const source = Buffer.from(await response.arrayBuffer());
      icons = await Promise.all([16, 32, 48, 128].map(async size => ({ size, data: new Uint8Array(await sharp(source).resize(size, size).png().toBuffer()) })));
    }
  } catch { icons = []; }
  const zip = zipFiles(chromeExtensionFiles(site, icons));
  return new Response(zip, { headers: { "content-type": "application/zip", "content-disposition": 'attachment; filename="dws-save-tabs.zip"', "cache-control": "no-store" } });
}
