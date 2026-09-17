// Image URLs may be signed: validate the scheme without sorting/removing query parameters.
export function safeImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 8192) return;
  try { const url = new URL(value); if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) return url.href; } catch { /* unavailable */ }
}
export function imageDimension(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 100000 ? Math.round(value) : undefined;
}
export function externalImageReference(metadata: Record<string, unknown> | undefined) {
  const result = metadata?.external_result as Record<string, unknown> | undefined;
  if (!result || result.resultType !== "image") return;
  return { image: safeImageUrl(result.imageUrl || result.url), thumbnail: safeImageUrl(result.thumbnailUrl), source: safeImageUrl(result.sourcePageUrl), width: imageDimension(result.imageWidth), height: imageDimension(result.imageHeight) };
}
