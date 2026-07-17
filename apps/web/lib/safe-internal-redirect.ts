const INTERNAL_ORIGIN = "https://internal.invalid";
const UNSAFE_REDIRECT_CHARACTERS = /[\\\u0000-\u001f\u007f]/;

export function safeInternalRedirect(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || UNSAFE_REDIRECT_CHARACTERS.test(value)) {
    return fallback;
  }

  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || UNSAFE_REDIRECT_CHARACTERS.test(decoded)) {
      return fallback;
    }

    const url = new URL(value, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
