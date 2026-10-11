export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_REGEX = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);
export const ROOM_CODE_EXTRACT_REGEX = new RegExp(`[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}`, "g");

export function normalizeRoomCode(input: string) {
  const urlCode = roomCodeFromInvitationUrl(input);
  if (urlCode !== null) return urlCode;

  const upper = input.toUpperCase();
  const runs = upper.match(/[A-Z0-9]+/g) ?? [];

  for (const run of [...runs].reverse()) {
    const cleanRun = keepRoomCodeCharacters(run);
    if (ROOM_CODE_REGEX.test(cleanRun)) {
      return cleanRun;
    }
    const suffix = cleanRun.slice(-ROOM_CODE_LENGTH);
    if (ROOM_CODE_REGEX.test(suffix)) {
      return suffix;
    }
  }

  const compact = keepRoomCodeCharacters(upper);
  const overlappingMatches = [...compact.matchAll(new RegExp(`(?=([${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}))`, "g"))].map(
    (match) => match[1],
  );
  const exact = overlappingMatches.at(-1);

  if (exact) {
    return exact;
  }

  return compact.slice(0, ROOM_CODE_LENGTH);
}

export function normalizeRoomCodeInput(input: string) {
  return normalizeRoomCode(input);
}

function roomCodeFromInvitationUrl(input: string): string | null {
  const candidates = input.split(/\s+/)
    .map((token) => token.replace(/^[([<"']+|[)\]>"'.,!;]+$/g, ""))
    .filter((token) => /[/\\]/.test(token)
      || /^(?:https?|ftp|file|mailto|javascript|data):|^[?#]|^[\w.-]+\.[a-z\d-]+(?:[:/?#]|$)/i.test(token));

  // null preserves plain-code editing; an invalid URL must never fall back to text extraction.
  if (candidates.length === 0) return null;
  if (candidates.length !== 1) return "";
  let candidate = candidates[0]!;
  if (/[\\\u0000-\u001f\u007f]/.test(candidate) || /^\/\/\//.test(candidate)) return "";
  if (/^[a-z][a-z\d+.-]*:/i.test(candidate) && !/^https?:\/\/[^/]/i.test(candidate)) return "";
  if (/^[\w.-]+\.[a-z\d-]+(?::\d+)?(?:[/#?]|$)/i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate, "https://room-code.invalid/");
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return "";
    const roomPath = url.pathname.match(/^\/(?:lobby|play|(?:werewolf|mafia)\/join)\/([^/]+)\/?$/);
    let code = roomPath ? decodeURIComponent(roomPath[1]!) : "";
    // The join entry pages also have an explicit ?code= contract; other query parameters are not codes.
    if (!roomPath && /^\/(?:join|(?:werewolf|mafia)\/join)\/?$/.test(url.pathname)) {
      const codes = url.searchParams.getAll("code");
      if (codes.length === 1) code = codes[0]!;
    }
    code = code.toUpperCase();
    return ROOM_CODE_REGEX.test(code) ? code : "";
  } catch {
    return "";
  }
}

function keepRoomCodeCharacters(input: string) {
  return input
    .split("")
    .filter((character) => ROOM_CODE_ALPHABET.includes(character))
    .join("");
}
