"use client";

import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { authRedirectURL } from "./verification-callback";
import type { RecoveryIcons } from "./RecoveryIcons";

const RESEND_COOLDOWN_SECONDS = 60;

export function ForgotPasswordClient({ icons }: {
  icons: Pick<RecoveryIcons, "header" | "success" | "send" | "edit" | "back">;
}) {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const signInHref = authRedirectURL("/sign-in", redirectTo);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [remaining, setRemaining] = useState(0);
  const pending = useRef(false);
  const deadline = useRef(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const editing = useRef(false);
  const id = useId();

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [remaining]);

  useEffect(() => {
    if (sent) {
      headingRef.current?.focus();
    } else if (editing.current) {
      emailRef.current?.focus();
      editing.current = false;
    }
  }, [sent]);

  function startCooldown() {
    deadline.current = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
    setRemaining(RESEND_COOLDOWN_SECONDS);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || Date.now() < deadline.current) return;
    // The email input is unmounted after success; resends use the submitted address.
    const nextEmail = sent ? email : String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setEmail(nextEmail);
    pending.current = true;
    setBusy(true);
    setErrorMsg("");

    try {
      const result = await authClient.requestPasswordReset({
        email: nextEmail,
        redirectTo: authRedirectURL("/reset-password", redirectTo),
      });
      if (result.error) {
        if (result.error.status === 429) {
          startCooldown();
          setErrorMsg("Твърде много заявки. Опитай отново след минута.");
        } else {
          setErrorMsg("Заявката не беше приета. Опитай отново след малко.");
        }
        return;
      }
      setSent(true);
      startCooldown();
    } catch {
      setErrorMsg("Не успяхме да се свържем. Провери връзката си и опитай отново.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="recovery-panel" aria-labelledby={`${id}-heading`}>
      <header className="recovery-header">
        <span className="recovery-icon" aria-hidden="true">
          {sent ? icons.success : icons.header}
        </span>
        <p className="recovery-kicker">Възстановяване на достъпа</p>
        <h1 id={`${id}-heading`} ref={headingRef} tabIndex={-1}>{sent ? "Провери имейла си" : "Забравена парола"}</h1>
        <p className="recovery-copy">
          {sent
            ? "Провери и папка „Спам“. Линкът е валиден за един час."
            : "Въведи имейла си, за да получиш линк за нова парола."}
        </p>
      </header>

      <form method="post" onSubmit={submit} className="recovery-form" aria-describedby={errorMsg ? `${id}-error` : undefined}>
        {sent ? (
          <p className="recovery-success" role="status">
            Ако има профил с този имейл, ще получиш линк за нова парола.
          </p>
        ) : (
          <div className="recovery-field">
            <label htmlFor={`${id}-email`}>Имейл</label>
            <input
              ref={emailRef}
              id={`${id}-email`}
              name="email"
              type="email"
              defaultValue={email}
              placeholder="ime@example.bg"
              autoComplete="email"
              readOnly={busy}
              required
            />
          </div>
        )}

        {errorMsg ? <p id={`${id}-error`} className="recovery-error" role="alert">{errorMsg}</p> : null}

        <div className="recovery-actions">
          <button type="submit" className="btn btn-primary" disabled={busy || remaining > 0} aria-busy={busy}>
            {icons.send}
            {busy ? "Изпращаме..." : `${sent ? "Изпрати нов линк" : "Изпрати линк"}${remaining > 0 ? ` (${remaining} сек.)` : ""}`}
          </button>
          {sent ? (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => {
              editing.current = true;
              setSent(false);
              setErrorMsg("");
            }}>
              {icons.edit}
              Промени имейла
            </button>
          ) : null}
        </div>
      </form>

      <footer className="recovery-footer">
        <Link href={signInHref} className="recovery-link">{icons.back}Към входа</Link>
      </footer>
    </section>
  );
}
