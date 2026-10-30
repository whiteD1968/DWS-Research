import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiTagRecord, imageTagModel, imageTagPrompt, imageTagSchema, imageTagSystem, nextText, parseImageDescription, type ImageDescription } from "@/lib/image-tags";
import { thumbnailBucket, thumbnailPath, thumbnailWidth } from "@/lib/thumbnails";

type Media = { id: string; title: string | null; bucket: string; storage_path: string | null; alt_text: string | null; caption: string | null; metadata: Record<string, unknown> | null };
export type DescribeResult = { described: number; failed: number; remaining: number; stopped: string; error: string };

export const imageTaggingReady = () => !!process.env.ANTHROPIC_API_KEY;
const columns = "id,title,bucket,storage_path,alt_text,caption,metadata";

// The cached library thumbnail is plenty for describing an image and keeps each request small; it is made here if missing.
async function imageBytes(db: SupabaseClient, ownerId: string, media: Media) {
  const path = thumbnailPath(ownerId, media.id);
  const existing = await db.storage.from(thumbnailBucket).download(path);
  if (existing.data) return Buffer.from(await existing.data.arrayBuffer());
  if (!media.storage_path) return null;
  const original = await db.storage.from(media.bucket).download(media.storage_path);
  if (!original.data) return null;
  try {
    const bytes = await sharp(Buffer.from(await original.data.arrayBuffer()), { failOn: "none" }).rotate().resize({ width: thumbnailWidth, height: thumbnailWidth * 1.5, fit: "inside", withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
    await db.storage.from(thumbnailBucket).upload(path, bytes, { contentType: "image/webp", upsert: true });
    return bytes;
  } catch { return null; }
}

async function describe(client: Anthropic, bytes: Buffer, existing: string[], title: string, withFallback = true): Promise<ImageDescription | null> {
  const request = {
    model: imageTagModel,
    max_tokens: 4000,
    output_config: { effort: "low", format: { type: "json_schema", schema: imageTagSchema } },
    system: imageTagSystem,
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: "image/webp", data: bytes.toString("base64") } },
      { type: "text", text: imageTagPrompt(existing, title) },
    ] }],
  } satisfies Anthropic.Beta.MessageCreateParamsNonStreaming;
  let response;
  try {
    response = withFallback ? await client.beta.messages.create({ ...request, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }) : await client.beta.messages.create(request);
  } catch (problem) {
    // An account that can't use refusal fallbacks gets a 400 for the parameter; the plain request still works.
    if (withFallback && problem instanceof Anthropic.BadRequestError) return describe(client, bytes, existing, title, false);
    throw problem;
  }
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
  const text = response.content.flatMap(block => (block.type === "text" ? [block.text] : [])).join("");
  return parseImageDescription(text, existing);
}

async function save(db: SupabaseClient, ownerId: string, media: Media, result: ImageDescription | null, error = "") {
  const previous = aiTagRecord(media.metadata);
  const at = new Date().toISOString();
  if (!result) {
    await db.from("media").update({ metadata: { ...(media.metadata || {}), ai_tags: { ...(previous || {}), failed: true, error: error || "No description came back.", at } } }).eq("owner_id", ownerId).eq("id", media.id);
    return false;
  }
  if (result.tags.length) {
    const { data: tags } = await db.from("tags").upsert(result.tags.map(name => ({ owner_id: ownerId, name })), { onConflict: "owner_id,name" }).select("id");
    if (tags?.length) await db.from("record_tags").upsert(tags.map(tag => ({ owner_id: ownerId, record_type: "media", record_id: media.id, tag_id: tag.id })), { onConflict: "record_type,record_id,tag_id", ignoreDuplicates: true });
  }
  const caption = nextText(media.caption, previous?.caption, result.caption);
  const alt = nextText(media.alt_text, previous?.alt_text, result.altText);
  // The media trigger leaves updated_at alone when only the description changes, so images keep their place under "newest".
  await db.from("media").update({
    ...(caption ? { caption } : {}), ...(alt ? { alt_text: alt } : {}),
    metadata: { ...(media.metadata || {}), ai_tags: { tags: result.tags, caption: result.caption, alt_text: result.altText, model: imageTagModel, at } },
  }).eq("owner_id", ownerId).eq("id", media.id);
  return true;
}

export async function countUndescribed(db: SupabaseClient, ownerId: string) {
  const { count } = await db.from("media").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("media_type", "image").not("storage_path", "is", null).is("metadata->ai_tags", null);
  return count ?? 0;
}

// Describes the given images, or the next undescribed ones, until the limit or the time budget runs out.
export async function describeImagesFor(db: SupabaseClient, ownerId: string, { ids, limit = 6, deadline = Date.now() + 50000 }: { ids?: string[]; limit?: number; deadline?: number } = {}): Promise<DescribeResult> {
  if (!imageTaggingReady()) throw new Error("Image tagging isn't set up yet. Add ANTHROPIC_API_KEY in Vercel.");
  let request = db.from("media").select(columns).eq("owner_id", ownerId).eq("media_type", "image").not("storage_path", "is", null);
  request = ids ? request.in("id", ids) : request.is("metadata->ai_tags", null).order("created_at", { ascending: false });
  const { data, error: loadError } = await request.limit(limit);
  if (loadError) throw new Error("Could not load your images.");
  const { data: tagRows } = await db.from("tags").select("name").eq("owner_id", ownerId).order("name").limit(300);
  const existing = (tagRows || []).map(row => String(row.name));

  // Each request gets less time than the server function has left, so a slow reply can't outlive the request.
  const client = new Anthropic({ maxRetries: 0, timeout: 25000 });
  let described = 0; let failed = 0; let stopped = ""; let firstError = "";
  const queue = [...(data || []) as Media[]];
  // Three at a time keeps a batch inside one server request without tripping rate limits.
  while (queue.length && !stopped && Date.now() < deadline - 27000) {
    const batch = queue.splice(0, 3);
    await Promise.all(batch.map(async media => {
      try {
        const bytes = await imageBytes(db, ownerId, media);
        const result = bytes ? await describe(client, bytes, existing, media.title || "") : null;
        if (await save(db, ownerId, media, result)) { described += 1; result?.tags.forEach(tag => { if (!existing.includes(tag)) existing.push(tag); }); } else failed += 1;
      } catch (problem) {
        if (problem instanceof Anthropic.AuthenticationError || problem instanceof Anthropic.PermissionDeniedError) stopped = "Anthropic turned down the API key. Check ANTHROPIC_API_KEY in Vercel.";
        else if (problem instanceof Anthropic.RateLimitError) stopped = "Claude is busy right now. Try again in a minute.";
        else if (problem instanceof Anthropic.APIError && problem.status === 400 && /credit|billing/i.test(problem.message)) stopped = "Your Anthropic account is out of credit.";
        else {
          // Marked as failed, with the reason, so the next batch moves on instead of retrying the same images forever.
          firstError ||= problem instanceof Error ? problem.message.slice(0, 300) : "Unknown error";
          failed += 1;
          await save(db, ownerId, media, null, problem instanceof Error ? problem.message.slice(0, 300) : "").catch(() => null);
        }
      }
    }));
  }
  return { described, failed, remaining: ids ? 0 : await countUndescribed(db, ownerId), stopped, error: firstError };
}
