export const maxPageImageBytes = 10 * 1024 * 1024;
export function pdfPageImagePath(ownerId: string, documentId: string, imageId: string) {
  const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
  if (![ownerId, documentId, imageId].every(value => uuid.test(value))) throw new Error("Invalid page identity.");
  return `${ownerId}/pdf-pages/${documentId}/${imageId}.png`;
}
export function validPageNumber(page: number) { return Number.isInteger(page) && page >= 1 && page <= 10000; }
