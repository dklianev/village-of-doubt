// The current safe_error protocol exposes Bulgarian copy, not an error code.
export function isDuplicateNameError(message: string) {
  return message.includes("Това име вече се използва в стаята.");
}

const JOIN_FAILURE_FALLBACK = "Не успяхме да те свържем със стаята. Опитай отново.";

/** Room refusals arrive as Bulgarian server copy; transport failures are blank or English. */
export function joinFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : "";
  return /[Ѐ-ӿ]/.test(message) ? message : JOIN_FAILURE_FALLBACK;
}
