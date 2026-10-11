import { createHash } from "node:crypto";
import type { SendEmailParams } from "@/lib/email";

const DELIVERY_TIMEOUT_MS = 10_000;
const RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 60_000;
const KEY_PATTERN = /^([0-9]{13})\.[0-9a-f]{64}$/;

export class ReportDeliveryError extends Error {
  constructor(
    readonly kind: "invalid_key" | "expired" | "unavailable" | "conflict" | "pending" | "uncertain",
  ) {
    super(kind);
  }
}

export function reportAttempt(key: string | null, now = Date.now()) {
  const match = key?.match(KEY_PATTERN);
  if (!match || Number(match[1]) > now + CLOCK_SKEW_MS) {
    throw new ReportDeliveryError("invalid_key");
  }
  // Resend retains keys for 24h. Never reuse one after that guarantee expires.
  // https://resend.com/docs/dashboard/emails/idempotency-keys
  if (now - Number(match[1]) >= RETRY_WINDOW_MS) {
    throw new ReportDeliveryError("expired");
  }
  const digest = createHash("sha256").update(key!).digest("hex");
  return {
    idempotencyKey: `report/${digest}`,
    referenceId: `СИГ-${digest.slice(0, 10).toUpperCase()}`,
  };
}

export async function sendReportEmail(params: SendEmailParams, key: string) {
  // Recheck immediately before delivery, including after a slow auth lookup.
  const attempt = reportAttempt(key);
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new ReportDeliveryError("unavailable");

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        reject(new ReportDeliveryError("uncertain"));
        controller.abort();
      }, DELIVERY_TIMEOUT_MS);
    });
    // The report transport uses the provider's HTTP idempotency contract directly:
    // abort covers the body too, and raw provider errors never reach dev logs.
    const { response, payload } = await Promise.race([
      (async () => {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": attempt.idempotencyKey,
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM ?? "Върколак и Мафия <noreply@local.invalid>",
            ...params,
          }),
          signal: controller.signal,
        });
        if (controller.signal.aborted) throw new ReportDeliveryError("uncertain");
        const payload: unknown = await response.json();
        return { response, payload };
      })(),
      deadline,
    ]);
    const data = payload && typeof payload === "object"
      ? payload as { id?: unknown; name?: unknown }
      : null;
    if (response.status === 409 && data?.name === "invalid_idempotent_request") {
      throw new ReportDeliveryError("conflict");
    }
    if (response.status === 409 && data?.name === "concurrent_idempotent_requests") {
      throw new ReportDeliveryError("pending");
    }
    if (!response.ok || typeof data?.id !== "string" || !data.id.trim()) {
      throw new ReportDeliveryError("uncertain");
    }
  } catch (error) {
    throw error instanceof ReportDeliveryError ? error : new ReportDeliveryError("uncertain");
  } finally {
    clearTimeout(timeout);
  }
}
