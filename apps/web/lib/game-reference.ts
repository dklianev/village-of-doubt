export function publicGameReference(gameId: string) {
  const compact = gameId.replaceAll("-", "").slice(0, 8).toUpperCase();
  return compact || "АРХИВ";
}
