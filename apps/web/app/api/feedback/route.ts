import { NextResponse } from "next/server";
import { renderFeedbackEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { auth } from "@/lib/auth";
import {
  createRuntimeIntakeRateLimiter,
  IntakeBodyError,
  readBoundedJson,
  requestRateLimitKey,
} from "@/lib/intake-security";

const VALID_CATEGORIES = new Set(["bug", "idea", "praise", "other"]);
const MAX_REQUEST_BYTES = 4_096;
const MAX_FEEDBACK_BODY_LENGTH = 2_000;
const MAX_EMAIL_LENGTH = 254;
const MAX_PAGE_LENGTH = 512;
const feedbackRateLimiter = createRuntimeIntakeRateLimiter(
  { limit: 10, windowMs: 10 * 60 * 1000 },
  "feedback",
);

const CATEGORY_LABEL_BG: Record<string, string> = {
  bug: "Бъг",
  idea: "Идея",
  praise: "Похвала",
  other: "Друго",
};

export async function POST(request: Request) {
  const rateLimit = await feedbackRateLimiter.check(requestRateLimitKey(request));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Изпрати твърде много бележки. Опитай отново след малко." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await readBoundedJson(request, MAX_REQUEST_BYTES);
  } catch (error) {
    const status = error instanceof IntakeBodyError && error.kind === "too_large" ? 413 : 400;
    return NextResponse.json({ error: "Бележката е невалидна или твърде голяма." }, { status });
  }
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;
  const page = typeof body.page === "string" ? body.page : "?";
  const rawCategory = typeof body.category === "string" ? body.category : "other";
  const category = VALID_CATEGORIES.has(rawCategory) ? rawCategory : "other";
  const categoryLabel = CATEGORY_LABEL_BG[category];

  if (text.length < 10) {
    return NextResponse.json({ error: "Кажи поне 10 символа." }, { status: 400 });
  }
  if (text.length > MAX_FEEDBACK_BODY_LENGTH || (email?.length ?? 0) > MAX_EMAIL_LENGTH || page.length > MAX_PAGE_LENGTH) {
    return NextResponse.json({ error: "Бележката съдържа прекалено дълго поле." }, { status: 400 });
  }

  let actor = "анонимен";
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session?.user?.email) actor = `${session.user.name ?? "?"} <${session.user.email}>`;
  } catch {
    // Feedback should still be accepted without session context.
  }

  const operatorEmail = process.env.REPORTS_NOTIFY_EMAIL;
  if (!operatorEmail) {
    console.error("[feedback] REPORTS_NOTIFY_EMAIL is not configured");
    return NextResponse.json({ error: "Бележките временно не са достъпни." }, { status: 503 });
  }

  try {
    const template = renderFeedbackEmail({
      brandUrl: process.env.BETTER_AUTH_URL ?? "",
      body: `[${categoryLabel}]\n${actor}\n\n${text}`,
      reporterEmail: email,
      page: `${page} · ${categoryLabel}`,
    });
    await sendEmail({ to: operatorEmail, ...template });
  } catch {
    console.error("[feedback] email delivery failed");
    return NextResponse.json({ error: "Бележката не успя да се изпрати." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
