export function portraitSlot(userId: string, slotCount = 9) {
  if (!Number.isInteger(slotCount) || slotCount <= 0) {
    throw new RangeError("slotCount must be a positive integer");
  }

  let hash = 2166136261;
  for (let index = 0; index < userId.length; index += 1) {
    hash ^= userId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % slotCount;
}
