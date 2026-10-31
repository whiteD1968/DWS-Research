// Importing Pinterest boards into the Library: the sign-in link, settings, and how a pin becomes an image. Pure, so it stays testable.

export const pinterestParent = "pinterest_settings";
export const pinterestApi = "https://api.pinterest.com/v5";
export const pinterestScopes = ["user_accounts:read", "boards:read", "boards:read_secret", "pins:read", "pins:read_secret"];
export const pinterestCallbackPath = "/api/pinterest/callback";
export const pinterestStateCookie = "pinterest_oauth_state";

export type PinterestSettings = { accessToken: string; refreshToken: string; expiresAt: number; refreshExpiresAt: number; username: string };
export type PinterestBoard = { id: string; name: string; description?: string; pin_count?: number; privacy?: string; media?: { image_cover_url?: string | null } };
type PinImage = { url?: string; width?: number; height?: number };
export type Pin = { id: string; title?: string | null; description?: string | null; link?: string | null; alt_text?: string | null; board_section_id?: string | null; created_at?: string;
  media?: { media_type?: string; images?: Record<string, PinImage>; items?: { images?: Record<string, PinImage> }[]; cover_image_url?: string } };

export const pinterestReady = () => !!process.env.PINTEREST_APP_ID && !!process.env.PINTEREST_APP_SECRET;

export function authorizeUrl(appId: string, redirectUri: string, state: string) {
  const query = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, response_type: "code", scope: pinterestScopes.join(","), state });
  return `https://www.pinterest.com/oauth/?${query}`;
}

const text = (value: unknown) => (typeof value === "string" ? value : "");
const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

export function pinterestSettingsFrom(meta: unknown): PinterestSettings {
  const value = (meta || {}) as Record<string, unknown>;
  return { accessToken: text(value.access_token), refreshToken: text(value.refresh_token), expiresAt: number(value.expires_at), refreshExpiresAt: number(value.refresh_expires_at), username: text(value.username) };
}

// What Pinterest's token endpoint returns, as stored settings; expiry is kept a minute early so a token never runs out mid-request.
export function tokenSettings(token: { access_token?: string; refresh_token?: string; expires_in?: number; refresh_token_expires_in?: number }, now = Date.now(), previousRefresh = "") {
  if (!token.access_token) return null;
  return {
    access_token: token.access_token,
    refresh_token: token.refresh_token || previousRefresh,
    expires_at: now + Math.max(0, number(token.expires_in) - 60) * 1000,
    ...(token.refresh_token_expires_in ? { refresh_expires_at: now + number(token.refresh_token_expires_in) * 1000 } : {}),
  };
}

// The largest image Pinterest offers for a pin: the pin's own images, or the first of a carousel.
export function bestImage(pin: Pin): PinImage | null {
  const sets = [pin.media?.images, ...(pin.media?.items || []).map(item => item.images)].filter(Boolean) as Record<string, PinImage>[];
  for (const images of sets) {
    const best = Object.entries(images).filter(([, image]) => typeof image?.url === "string" && /^https:\/\//.test(image.url))
      .sort(([keyA, a], [keyB, b]) => (keyB === "originals" ? 1 : 0) - (keyA === "originals" ? 1 : 0) || number(b.width) - number(a.width))[0];
    if (best) return best[1];
  }
  return pin.media?.cover_image_url && /^https:\/\//.test(pin.media.cover_image_url) ? { url: pin.media.cover_image_url } : null;
}

const clean = (value: unknown, max: number) => text(value).replace(/\s+/g, " ").trim().slice(0, max);

// The Library fields for a pin. The title stays a file name when the pin has none, so describing the image gives it a readable one.
export function pinRecord(pin: Pin, board: { id: string; name: string }, section = "") {
  const title = clean(pin.title, 200);
  return {
    title: title || `pinterest-${pin.id}`,
    original_filename: `pinterest-${pin.id}`,
    alt_text: clean(pin.alt_text, 500) || null,
    metadata: { origin: "pinterest", pinterest: { pin_id: pin.id, board_id: board.id, board: board.name, ...(section ? { section } : {}), link: clean(pin.link, 1000) || null, description: clean(pin.description, 2000) || null, url: `https://www.pinterest.com/pin/${pin.id}/`, saved_at: pin.created_at || null } },
  };
}

export const extensionFor = (mime: string) => ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" } as Record<string, string>)[mime] || "";
