export function buildEditorStateUrl(
  currentUrl: string,
  queryParam: string,
  editorId?: string,
) {
  const url = new URL(currentUrl);

  if (editorId) {
    url.searchParams.set(queryParam, editorId);
  } else {
    url.searchParams.delete(queryParam);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
