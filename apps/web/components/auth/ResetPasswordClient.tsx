"use client";

import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { authRedirectURL } from "./verification-callback";
import type { RecoveryIcons } from "./RecoveryIcons";

export function ResetPasswordClient({ icons }: {
  icons: Pick<RecoveryIcons, "header" | "success" | "submit" | "show" | "hide" | "send" | "back" | "forward">;
}) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const callbackError = searchParams.get("error") ?? "";
  const redirectTo = searchParams.get("redirect");
  const signInHref = authRedirectURL("/sign-in", redirectTo);
  const forgotHref = authRedirectURL("/forgot-password", redirectTo);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error" | "invalid">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const pending = useRef(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const invalid = Boolean(callbackError) || status === "invalid";
  const missing = !token && !invalid;
  const done = status === "done";
  const busy = status === "submitting";

  useEffect(() => {
    if (done) headingRef.current?.focus();
  }, [done]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || done || invalid || missing) return;
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirmPassword") ?? "");
    setErrorMsg("");
    setPasswordError("");
    setConfirmError("");

    if (password.length < 8) {
      setPasswordError("Паролата трябва да е поне 8 символа.");
      passwordRef.current?.focus();
      return;
    }
    if (password !== confirm) {
      setConfirmError("Паролите не съвпадат.");
      confirmRef.current?.focus();
      return;
    }

    pending.current = true;
    setStatus("submitting");
    try {
      const result = await authClient.resetPassword({ token, newPassword: password });
      if (result.error) {
        if (result.error.code === "INVALID_TOKEN" || result.error.code === "TOKEN_EXPIRED") {
          setStatus("invalid");
        } else if (result.error.code === "PASSWORD_TOO_SHORT" || result.error.code === "PASSWORD_TOO_LONG") {
          setPasswordError(result.error.code === "PASSWORD_TOO_SHORT"
            ? "Паролата трябва да е поне 8 символа."
            : "Паролата е твърде дълга. Избери по-кратка.");
          setStatus("error");
          passwordRef.current?.focus();
        } else {
          setErrorMsg(result.error.status === 429
            ? "Твърде много опити. Опитай отново след минута."
            : "Паролата не е сменена. Опитай отново или заяви нов линк.");
          setStatus("error");
        }
        return;
      }
      setStatus("done");
    } catch {
      setErrorMsg("Не успяхме да се свържем. Провери връзката си и опитай отново.");
      setStatus("error");
    } finally {
      pending.current = false;
    }
  }

  return (
    <section className="recovery-panel">
      <header className="recovery-header">
        <span className="recovery-icon" aria-hidden="true">
          {done ? icons.success : icons.header}
        </span>
        <p className="recovery-kicker">Възстановяване на достъпа</p>
        <h1 id={`${id}-heading`} ref={headingRef} tabIndex={-1}>
          {invalid ? "Невалиден линк" : missing ? "Липсва линк за нова парола" : done ? "Паролата е сменена" : "Нова парола"}
        </h1>
        <p className="recovery-copy">
          {invalid || missing
            ? "Заяви нов линк, за да смениш паролата си."
            : done
              ? "Вече можеш да влезеш с новата си парола."
              : "Избери парола, която не използваш другаде."}
        </p>
      </header>

      {invalid || missing ? (
        <>
          <p className="recovery-error" role="alert">
            {invalid ? "Линкът е изтекъл или невалиден." : "Отвори линка от имейла за смяна на паролата."}
          </p>
          <div className="recovery-actions">
            <Link href={forgotHref} className="btn btn-primary">{icons.send}Заяви нов линк</Link>
          </div>
        </>
      ) : done ? (
        <>
          <p className="recovery-success" role="status">Паролата е сменена. Влез, за да продължиш.</p>
          <div className="recovery-actions">
            <Link href={signInHref} className="btn btn-primary">Към входа{icons.forward}</Link>
          </div>
        </>
      ) : (
        <form method="post" onSubmit={submit} className="recovery-form" noValidate aria-describedby={errorMsg ? `${id}-error` : undefined}>
          <div className="recovery-field">
            <label htmlFor={`${id}-password`}>Нова парола</label>
            <div className="recovery-password">
              <input
                ref={passwordRef}
                id={`${id}-password`}
                name="password"
                type={showPassword ? "text" : "password"}
                onChange={() => setPasswordError("")}
                minLength={8}
                autoComplete="new-password"
                aria-invalid={Boolean(passwordError)}
                aria-describedby={`${id}-hint${passwordError ? ` ${id}-password-error` : ""}`}
                readOnly={busy}
                required
              />
              <button type="button" className="recovery-reveal" aria-controls={`${id}-password`} aria-pressed={showPassword}
                aria-label={showPassword ? "Скрий новата парола" : "Покажи новата парола"}
                title={showPassword ? "Скрий новата парола" : "Покажи новата парола"}
                onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? icons.hide : icons.show}
              </button>
            </div>
            <p id={`${id}-hint`} className="recovery-copy">Поне 8 символа.</p>
            {passwordError ? <p id={`${id}-password-error`} className="recovery-error" role="alert">{passwordError}</p> : null}
          </div>
          <div className="recovery-field">
            <label htmlFor={`${id}-confirm`}>Повтори паролата</label>
            <div className="recovery-password">
              <input
                ref={confirmRef}
                id={`${id}-confirm`}
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                onChange={() => setConfirmError("")}
                autoComplete="new-password"
                aria-invalid={Boolean(confirmError)}
                aria-describedby={confirmError ? `${id}-confirm-error` : undefined}
                readOnly={busy}
                required
              />
              <button type="button" className="recovery-reveal" aria-controls={`${id}-confirm`} aria-pressed={showConfirm}
                aria-label={showConfirm ? "Скрий повторената парола" : "Покажи повторената парола"}
                title={showConfirm ? "Скрий повторената парола" : "Покажи повторената парола"}
                onClick={() => setShowConfirm((value) => !value)}>
                {showConfirm ? icons.hide : icons.show}
              </button>
            </div>
            {confirmError ? <p id={`${id}-confirm-error`} className="recovery-error" role="alert">{confirmError}</p> : null}
          </div>

          {errorMsg ? <p id={`${id}-error`} className="recovery-error" role="alert">{errorMsg}</p> : null}

          <div className="recovery-actions">
            <button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy}>
              {icons.submit}{busy ? "Запазваме..." : "Запази паролата"}
            </button>
            {status === "error" ? <Link href={forgotHref} className="recovery-link">Заяви нов линк</Link> : null}
          </div>
        </form>
      )}

      {!done ? (
        <footer className="recovery-footer">
          <Link href={signInHref} className="recovery-link">{icons.back}Към входа</Link>
        </footer>
      ) : null}
    </section>
  );
}
