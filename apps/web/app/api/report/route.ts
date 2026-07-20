import { NextResponse } from "next/server";
import { renderFeedbackEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { auth } from "@/lib/auth";
import {
  createIntakeRateLimiter,
  IntakeBodyError,
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
const MAX_REQUEST_BYTES = 8_192;
const MAX_REPORT_BODY_LENGTH = 4_000;
const MAX_EVIDENCE_LENGTH = 500;
const MAX_EMAIL_LENGTH = 254;
const reportRateLimiter = createIntakeRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

const TYPE_LABEL_BG: Record<string, string> = {
  abuse: "Тормоз",
  copyright: "Авторски права",
  bug: "Бъг",
  gdpr: "GDPR",
  other: "Друго",
};

export async function POST(request: Request) {
  const rateLimit = reportRateLimiter.check(requestRateLimitKey(request));
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

  let actorContext = "анонимен";
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session?.user?.email) {
      actorContext = `${session.user.name ?? "?"} <${session.user.email}>`;
    }
  } catch {
    // Signal intake stays available even if session lookup fails.
  }

  const operatorEmail = process.env.REPORTS_NOTIFY_EMAIL;
  if (!operatorEmail) {
    console.error("[report] REPORTS_NOTIFY_EMAIL is not configured");
    return NextResponse.json({ error: "Сигналите временно не са достъпни." }, { status: 503 });
  }

  const typeLabel = TYPE_LABEL_BG[type] ?? TYPE_LABEL_BG.other;
  const summary = `[${typeLabel}] ${actorContext} | Доказателство: ${evidence ?? "няма"}\n\n${reportBody}`;

  try {
    const template = renderFeedbackEmail({
      brandUrl: process.env.BETTER_AUTH_URL ?? "",
      body: summary,
      reporterEmail,
      page: `/report · ${typeLabel}`,
    });
    await sendEmail({ to: operatorEmail, ...template });
  } catch {
    console.error("[report] email delivery failed");
    return NextResponse.json({ error: "Сигналът не успя да се изпрати. Опитай отново." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
