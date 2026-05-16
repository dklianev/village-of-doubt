import { Resend } from "resend";
import { appendFileSync } from "node:fs";

const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_ADDRESS = process.env.RESEND_FROM ?? "Върколак и Мафия <noreply@local.invalid>";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(params: SendEmailParams) {
  if (!resendClient) {
    if (process.env.NODE_ENV === "production" && !canUseDevEmailSink()) {
      throw new Error("RESEND_API_KEY липсва в производствена среда.");
    }

    console.log("[email:dev]", params.subject, "->", params.to);
    console.log("[email:dev:html]", params.html);
    writeDevEmail(params);
    return null;
  }

  const result = await resendClient.emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  if (result.error) {
    throw new Error(`Грешка при изпращане на имейл: ${result.error.message}`);
  }

  return result.data;
}

function canUseDevEmailSink() {
  if (process.env.ALLOW_DEV_AUTH !== "true") {
    return false;
  }

  return isLocalUrl(process.env.BETTER_AUTH_URL) || isLocalUrl(process.env.NEXT_PUBLIC_APP_URL);
}

function isLocalUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  } catch {
    return false;
  }
}

function writeDevEmail(params: SendEmailParams) {
  if (!process.env.E2E_EMAIL_OUTBOX) {
    return;
  }

  appendFileSync(process.env.E2E_EMAIL_OUTBOX, `${JSON.stringify({ ...params, sentAt: new Date().toISOString() })}\n`);
}
