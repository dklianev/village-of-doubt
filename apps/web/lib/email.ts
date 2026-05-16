import { Resend } from "resend";

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
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY липсва в производствена среда.");
    }

    console.log("[email:dev]", params.subject, "->", params.to);
    console.log("[email:dev:html]", params.html);
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
