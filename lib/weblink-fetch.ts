import { lookup } from "node:dns/promises";
import { frameStatusFromHeaders, isPrivateHost, pageInfoFromHtml, type PageInfo } from "@/lib/weblinks";

const agent = "Mozilla/5.0 (compatible; DWSResearch/1.0; +link preview)";

// Fetches a page's title, description, preview image, and whether it allows being shown in a frame.
// Only public http(s) hosts are fetched, every redirect is checked again, and nothing waits longer than the timeout.
export async function fetchPageInfo(rawUrl: string, ownOrigin = "", timeoutMs = 6000): Promise<PageInfo | null> {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return null; }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let hop = 0; hop < 5; hop++) {
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      if (isPrivateHost(url.hostname)) return null;
      const addresses = await lookup(url.hostname, { all: true }).catch(() => []);
      if (!addresses.length || addresses.some(address => isPrivateHost(address.address))) return null;
      const response = await fetch(url, { redirect: "manual", signal: controller.signal, headers: { "user-agent": agent, accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5", "accept-language": "en-US,en;q=0.8" } });
      if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
        url = new URL(response.headers.get("location")!, url);
        await response.body?.cancel().catch(() => null);
        continue;
      }
      const frame = frameStatusFromHeaders(response.headers, ownOrigin);
      const type = response.headers.get("content-type") || "";
      if (!response.ok || !/html|xml/i.test(type)) {
        await response.body?.cancel().catch(() => null);
        return { title: "", description: "", siteName: "", image: "", frame: response.ok ? frame : "unknown" };
      }
      const html = await readCapped(response, 400_000);
      return { ...pageInfoFromHtml(html, url.toString()), frame };
    }
    return null;
  } catch { return null; } finally { clearTimeout(timer); }
}

async function readCapped(response: Response, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = []; let size = 0;
  while (size < limit) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value); size += value.length;
  }
  await reader.cancel().catch(() => null);
  const merged = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { merged.set(chunk.subarray(0, Math.min(chunk.length, size - offset)), offset); offset += chunk.length; if (offset >= size) break; }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

// Runs tasks a few at a time and stops starting new ones once the time budget is used.
export async function inBatches<T>(items: T[], size: number, budgetMs: number, task: (item: T) => Promise<void>) {
  const started = Date.now(); let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length && Date.now() - started < budgetMs) { const item = items[next++]!; await task(item).catch(() => null); }
  }));
  return next;
}
