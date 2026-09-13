import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { verificationCallbackURL } from "./verification-callback";
import styles from "./VerificationEmailRequest.module.css";

const RESEND_COOLDOWN_SECONDS = 60;
const SENT_MESSAGE = "Ако имейлът очаква потвърждение, ще получиш линк. Провери и папка „Спам“.";

export function VerificationEmailRequest({
  initialEmail = "",
  redirectTo,
  initialCooldownSeconds = 0,
}: {
  initialEmail?: string;
  redirectTo: string;
  initialCooldownSeconds?: number;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(initialCooldownSeconds > 0);
  const [remaining, setRemaining] = useState(initialCooldownSeconds);
  const deadline = useRef(Date.now() + initialCooldownSeconds * 1000);
  const pending = useRef(false);
  const emailId = useId();

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

  return (
    <form className={styles.form} onSubmit={submit}>
      <label htmlFor={emailId}>Имейл</label>
      <input id={emailId} type="email" autoComplete="email" required value={email}
        onChange={(event) => setEmail(event.target.value)} disabled={busy} />
      {sent ? <p role="status" aria-live="polite">{SENT_MESSAGE}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" className="btn btn-secondary" disabled={busy || remaining > 0} aria-busy={busy}>
        {busy ? "Изпращаме..." : remaining > 0 ? `Изпрати нов линк (${remaining} сек.)` : "Изпрати нов линк"}
      </button>
    </form>
  );
}
