export type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function getSearchParam(
  searchParams: PageSearchParams | undefined,
  key: string,
) {
  const params = searchParams ? await searchParams : {};
  const value = params[key];

  return Array.isArray(value) ? value[0] : value;
}
