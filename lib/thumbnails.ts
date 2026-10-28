// Small cached copies for library grids; originals stay untouched for detail views and downloads.
export const thumbnailBucket = "research-media";
export const thumbnailWidth = 600;
export const thumbnailPath = (ownerId: string, mediaId: string) => `${ownerId}/thumbs/${mediaId}.webp`;
export const thumbnailUrl = (mediaId: string) => `/library/thumb/${encodeURIComponent(mediaId)}`;
