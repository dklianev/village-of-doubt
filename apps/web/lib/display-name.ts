export const MIN_DISPLAY_NAME_LENGTH = 2;
export const MAX_DISPLAY_NAME_LENGTH = 32;
const UNSAFE_DISPLAY_NAME_CHARACTERS = /[\p{Cc}\p{Cf}]/u;
const CONTROL_CHARACTERS = /\p{Cc}+/gu;
const FORMAT_CHARACTERS = /\p{Cf}+/gu;

export type DisplayNameValidation =
  | { ok: true; displayName: string }
  | { ok: false; error: string };

export function normalizeDisplayName(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : "";
}

export function validateDisplayName(value: unknown): DisplayNameValidation {
  if (typeof value === "string" && UNSAFE_DISPLAY_NAME_CHARACTERS.test(value)) {
    return { ok: false, error: "Името съдържа непозволени невидими знаци." };
  }

  const displayName = normalizeDisplayName(value);

  if (displayName.length < MIN_DISPLAY_NAME_LENGTH) {
    return { ok: false, error: "Името трябва да е поне 2 символа." };
  }
  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return { ok: false, error: "Името трябва да е най-много 32 символа." };
  }

  return { ok: true, displayName };
}

export function normalizeExternalDisplayName(value: unknown): string {
  const displayName = normalizeGameTokenDisplayName(value);
  const validation = validateDisplayName(displayName);

  return validation.ok ? validation.displayName : "Играч";
}

export function normalizeGameTokenDisplayName(value: unknown): string {
  const sanitized = typeof value === "string"
    ? value.replace(FORMAT_CHARACTERS, "").replace(CONTROL_CHARACTERS, " ")
    : "";
  const displayName = normalizeDisplayName(sanitized);
  if (displayName.length <= MAX_DISPLAY_NAME_LENGTH) {
    return displayName;
  }

  return displayName.slice(0, MAX_DISPLAY_NAME_LENGTH).trimEnd();
}
