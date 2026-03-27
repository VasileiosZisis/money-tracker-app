export type SearchParamsShape = Record<string, string | string[] | undefined>;

export type PageSearchParams = Promise<SearchParamsShape>;

export async function resolveSearchParams(
  searchParams?: PageSearchParams,
): Promise<SearchParamsShape> {
  return (await searchParams) ?? {};
}

export function firstSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function buildPathWithSearchParams(
  pathname: string,
  params: Record<string, string | undefined>,
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  const serialized = query.toString();
  return serialized.length > 0 ? `${pathname}?${serialized}` : pathname;
}
