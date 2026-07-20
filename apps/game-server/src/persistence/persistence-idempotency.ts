import { createHash } from "node:crypto";

export type PersistenceEntity = "game" | "event";

const PERSISTENCE_NAMESPACE = Buffer.from("4c7dc6af153d4e4ba664d99dd972b472", "hex");

export function derivePersistenceId(entity: PersistenceEntity, idempotencyKey: string): string {
  if (!idempotencyKey.trim()) {
    throw new Error("Idempotency key must not be empty.");
  }

  const bytes = createHash("sha1")
    .update(PERSISTENCE_NAMESPACE)
    .update(`${entity}:${idempotencyKey}`)
    .digest()
    .subarray(0, 16);
  // RFC 9562 UUIDv5 version and variant bits.
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
