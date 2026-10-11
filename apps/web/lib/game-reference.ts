export function publicGameReference(gameId: string) {
  // A display label shared by archive, account and replay, never a room access code.
  let hash = 2_166_136_261;
  for (const character of gameId.toLowerCase()) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619);
  }
  return String(hash >>> 0).padStart(8, "0");
}
