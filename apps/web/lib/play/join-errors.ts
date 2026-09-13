// The current safe_error protocol exposes Bulgarian copy, not an error code.
export function isDuplicateNameError(message: string) {
  return message.includes("Това име вече се използва в стаята.");
}
