import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { renderFeedbackEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { auth } from "@/lib/auth";

interface ReportBody {
  type?: unknown;
  body?: unknown;
  email?: unknown;
  evidence?: unknown;
}

const VALID_TYPES = new Set(["abuse", "copyright", "bug", "gdpr", "other"]);

const TYPE_LABEL_BG: Record<string, string> = {
  abuse: "Тормоз",
  copyright: "Авторски права",
  bug: "Бъг",
  gdpr: "GDPR",
  other: "Друго",
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ReportBody;

  const type = typeof body.type === "string" && VALID_TYPES.has(body.type) ? body.type : "other";
  const reportBody = typeof body.body === "string" ? body.body.trim() : "";
  const reporterEmail = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;
  const evidence = typeof body.evidence === "string" && body.evidence.trim() ? body.evidence.trim() : null;

  if (reportBody.length < 20) {
    return NextResponse.json({ error: "Опиши проблема с поне 20 символа." }, { status: 400 });
  }

  let actorContext = "анонимен";
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.email) {
      actorContext = `${session.user.name ?? "?"} <${session.user.email}>`;
    }
  } catch {
    // Signal intake stays available even if session lookup fails.
  }

  const operatorEmail = process.env.REPORTS_NOTIFY_EMAIL;
  if (!operatorEmail) {
    console.error("[report] REPORTS_NOTIFY_EMAIL не е конфигуриран - сигналът се записва в console.");
    console.error(JSON.stringify({ type, reportBody, reporterEmail, evidence, actorContext }, null, 2));
    return NextResponse.json({ ok: true });
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
  } catch (error) {
    console.error("[report] email failed", error);
    return NextResponse.json({ error: "Сигналът не успя да се изпрати. Опитай отново." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
