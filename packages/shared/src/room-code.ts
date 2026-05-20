export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_REGEX = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);
export const ROOM_CODE_EXTRACT_REGEX = new RegExp(`[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}`, "g");

export function normalizeRoomCodeInput(input: string) {
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

function keepRoomCodeCharacters(input: string) {
  return input
    .split("")
    .filter((character) => ROOM_CODE_ALPHABET.includes(character))
    .join("");
}
