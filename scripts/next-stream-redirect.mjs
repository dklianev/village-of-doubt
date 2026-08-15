const NEXT_REDIRECT_PATTERN = /NEXT_REDIRECT;(?:push|replace);([^;]+);(?:301|302|303|307|308);/;

export function extractNextStreamRedirect(body) {
  const location = body.match(NEXT_REDIRECT_PATTERN)?.[1];
  if (!location) return null;

  return location
    .replaceAll("\\u0026", "&")
    .replaceAll("&amp;", "&");
}
