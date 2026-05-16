import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { renderFeedbackEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;
  const page = typeof body.page === "string" ? body.page : "?";

  if (text.length < 10) {
    return NextResponse.json({ error: "Кажи поне 10 символа." }, { status: 400 });
  }

  let actor = "анонимен";
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.email) actor = `${session.user.name ?? "?"} <${session.user.email}>`;
  } catch {
    // Feedback should still be accepted without session context.
  }

  const operatorEmail = process.env.REPORTS_NOTIFY_EMAIL;
  if (!operatorEmail) {
    console.log("[feedback]", { text, email, page, actor });
    return NextResponse.json({ ok: true });
  }

  try {
    const template = renderFeedbackEmail({
      brandUrl: process.env.BETTER_AUTH_URL ?? "",
      body: `${actor}\n\n${text}`,
      reporterEmail: email,
      page,
    });
    await sendEmail({ to: operatorEmail, ...template });
  } catch (error) {
    console.error("[feedback] email failed", error);
    return NextResponse.json({ error: "Бележката не успя да се изпрати." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
