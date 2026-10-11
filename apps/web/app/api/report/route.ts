import { NextResponse } from "next/server";
import { renderFeedbackEmail } from "@/lib/email-templates";
import { auth } from "@/lib/auth";
import { reportAttempt, ReportDeliveryError, sendReportEmail } from "./delivery";
import {
  createRuntimeIntakeRateLimiter,
  IntakeBodyError,
  isValidIntakeEmail,
  readBoundedJson,
  requestRateLimitKey,
} from "@/lib/intake-security";

interface ReportBody {
  type?: unknown;
  body?: unknown;
  email?: unknown;
  evidence?: unknown;
}

const VALID_TYPES = new Set(["abuse", "copyright", "bug", "gdpr", "other"]);
// Allow full fields even when each UTF-16 code unit is JSON-escaped as \uXXXX.
// Keep a separate, bounded transport limit for whitespace and unknown fields.
const MAX_REQUEST_BYTES = 32_768;
const MAX_REPORT_BODY_LENGTH = 4_000;
const MAX_EVIDENCE_LENGTH = 500;
const MAX_EMAIL_LENGTH = 254;
const reportRateLimiter = createRuntimeIntakeRateLimiter(
  { limit: 5, windowMs: 10 * 60 * 1000 },
  "report",
);

const TYPE_LABEL_BG: Record<string, string> = {
  abuse: "Тормоз",
  copyright: "Авторски права",
  bug: "Бъг",
  gdpr: "GDPR",
  other: "Друго",
};

export async function POST(request: Request) {
  const rateLimit = await reportRateLimiter.check(requestRateLimitKey(request));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Изпрати твърде много сигнали. Опитай отново след малко." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  let body: ReportBody;
  try {
    body = await readBoundedJson(request, MAX_REQUEST_BYTES);
  } catch (error) {
    const status = error instanceof IntakeBodyError && error.kind === "too_large" ? 413 : 400;
    return NextResponse.json({ error: "Сигналът е невалиден или твърде голям." }, { status });
  }

  const type = typeof body.type === "string" && VALID_TYPES.has(body.type) ? body.type : "other";
  const reportBody = typeof body.body === "string" ? body.body.trim() : "";
  const reporterEmail = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;
  const evidence = typeof body.evidence === "string" && body.evidence.trim() ? body.evidence.trim() : null;

  if (reportBody.length < 20) {
    return NextResponse.json({ error: "Опиши проблема с поне 20 символа." }, { status: 400 });
  }
  if (
    reportBody.length > MAX_REPORT_BODY_LENGTH ||
    (reporterEmail?.length ?? 0) > MAX_EMAIL_LENGTH ||
    (evidence?.length ?? 0) > MAX_EVIDENCE_LENGTH
  ) {
    return NextResponse.json({ error: "Сигналът съдържа прекалено дълго поле." }, { status: 400 });
  }
  if (reporterEmail && !isValidIntakeEmail(reporterEmail)) {
    return NextResponse.json({ error: "Въведи валиден имейл." }, { status: 400 });
  }

  const attemptKey = request.headers.get("idempotency-key");
  let referenceId: string;
  try {
    referenceId = reportAttempt(attemptKey).referenceId;
  } catch (error) {
    return deliveryErrorResponse(error);
  }

  let actorContext = reporterEmail ?? "анонимен";
  if (reporterEmail) {
    try {
      const session = await auth.api.getSession({ headers: request.headers });
      if (session?.user?.email.toLowerCase() === reporterEmail.toLowerCase()) {
        actorContext = `${session.user.name ?? "?"} <${session.user.email}>`;
      }
    } catch {
      // Identified reports remain available even if session lookup fails.
    }
  }

  const operatorEmail = process.env.REPORTS_NOTIFY_EMAIL;
  if (!operatorEmail) {
    console.error("[report] REPORTS_NOTIFY_EMAIL is not configured");
    return NextResponse.json({ error: "Сигналите временно не са достъпни." }, { status: 503 });
  }

  const typeLabel = TYPE_LABEL_BG[type] ?? TYPE_LABEL_BG.other;
  const summary = `[${referenceId}] [${typeLabel}] ${actorContext} | Доказателство: ${evidence ?? "няма"}\n\n${reportBody}`;

  try {
    const template = renderFeedbackEmail({
      brandUrl: process.env.BETTER_AUTH_URL ?? "",
      body: summary,
      reporterEmail,
      page: `/report · ${typeLabel}`,
    });
    await sendReportEmail({
      to: operatorEmail,
      ...template,
      subject: `${template.subject} · ${referenceId}`,
    }, attemptKey!);
  } catch (error) {
    console.error("[report] email delivery failed");
    return deliveryErrorResponse(error);
  }

  return NextResponse.json({ ok: true, referenceId });
}

function deliveryErrorResponse(error: unknown) {
  const kind = error instanceof ReportDeliveryError ? error.kind : "uncertain";
  switch (kind) {
    case "invalid_key":
      return NextResponse.json({ error: "Невалиден опит за изпращане. Провери часовника на устройството и отвори сигнала отново." }, { status: 400 });
    case "expired":
      return NextResponse.json({ error: "Срокът за безопасно повторение изтече. Не можем да потвърдим дали сигналът е получен." }, { status: 409 });
    case "conflict":
      return NextResponse.json({ error: "Сигналът или данните за връзка са променени. Предишното изпращане не може да бъде потвърдено." }, { status: 409 });
    case "pending":
      return NextResponse.json({ error: "Сигналът още се изпраща. Опитай отново след малко." }, { status: 409, headers: { "Retry-After": "5" } });
    case "unavailable":
      return NextResponse.json({ error: "Сигналите временно не са достъпни." }, { status: 503 });
    default:
      return NextResponse.json({ error: "Не успяхме да потвърдим изпращането. Опитай отново след малко." }, { status: 503, headers: { "Retry-After": "5" } });
  }
}
