import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { verificationCallbackURL } from "./verification-callback";
import styles from "./VerificationEmailRequest.module.css";

const RESEND_COOLDOWN_SECONDS = 60;
const SENT_MESSAGE = "Ако имейлът очаква потвърждение, ще получиш линк. Провери и папка „Спам“.";

export function VerificationEmailRequest({
  initialEmail = "",
  redirectTo,
  initialCooldownSeconds = 0,
  variant = "secondary",
  sendIcon,
}: {
  initialEmail?: string;
  redirectTo: string;
  initialCooldownSeconds?: number;
  variant?: "primary" | "secondary";
  sendIcon?: ReactNode;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(initialCooldownSeconds > 0);
  const [remaining, setRemaining] = useState(initialCooldownSeconds);
  const deadline = useRef(Date.now() + initialCooldownSeconds * 1000);
  const pending = useRef(false);
  const emailId = useId();
  const recovery = variant === "primary";

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [remaining]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || Date.now() < deadline.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setSent(false);
    try {
      const result = await authClient.sendVerificationEmail({
        email: email.trim(),
        callbackURL: verificationCallbackURL(redirectTo),
      });
      if (result.error) {
        if (result.error.status === 429) {
          deadline.current = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
          setRemaining(RESEND_COOLDOWN_SECONDS);
          setError("Твърде много заявки. Опитай отново след минута.");
          return;
        }
        setError("Заявката не беше приета. Опитай отново след малко или влез, ако вече си потвърдил имейла.");
        return;
      }
      setSent(true);
      deadline.current = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
      setRemaining(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError("Не успяхме да се свържем. Провери връзката си и опитай отново.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const field = (
    <>
      <label htmlFor={emailId}>Имейл</label>
      <input id={emailId} type="email" autoComplete="email" required value={email}
        aria-describedby={error ? `${emailId}-error` : undefined}
        onChange={(event) => setEmail(event.target.value)} disabled={busy} />
    </>
  );
  const button = (
    <button type="submit" className={recovery ? "btn btn-primary" : "btn btn-secondary"} disabled={busy || remaining > 0} aria-busy={busy}>
      {recovery ? sendIcon : null}
      {busy ? "Изпращаме..." : remaining > 0 ? `Изпрати нов линк (${remaining} сек.)` : "Изпрати нов линк"}
    </button>
  );

  return (
    <form className={recovery ? "recovery-form" : styles.form} onSubmit={submit}>
      {recovery ? <div className="recovery-field">{field}</div> : field}
      {sent ? <p className={recovery ? "recovery-success" : undefined} role="status" aria-live="polite">{SENT_MESSAGE}</p> : null}
      {error ? <p id={`${emailId}-error`} className={recovery ? "recovery-error" : undefined} role="alert">{error}</p> : null}
      {recovery ? <div className="recovery-actions">{button}</div> : button}
    </form>
  );
}
