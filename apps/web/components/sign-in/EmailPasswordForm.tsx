"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { mapAuthError } from "@/lib/auth-errors";
import { MAX_DISPLAY_NAME_LENGTH, validateDisplayName } from "@/lib/display-name";
import { VerificationEmailRequest } from "@/components/auth/VerificationEmailRequest";
import { authRedirectURL, verificationCallbackURL } from "@/components/auth/verification-callback";
import { resolveWelcomeRedirect } from "./welcome-redirect";

type Mode = "sign-in" | "sign-up";
type ValidationField = "name" | "email" | "password" | null;

export function EmailPasswordForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [validationField, setValidationField] = useState<ValidationField>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [verification, setVerification] = useState<{ email: string; cooldown: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const statusId = useId();
  const panelId = useId();
  const signInTabId = useId();
  const signUpTabId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const verificationHeadingRef = useRef<HTMLHeadingElement>(null);
  const wasVerifyingRef = useRef(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const signInTabRef = useRef<HTMLButtonElement>(null);
  const signUpTabRef = useRef<HTMLButtonElement>(null);
  const isBusy = isSubmitting || isPending;

  useEffect(() => {
    if (verification) {
      verificationHeadingRef.current?.focus();
    } else if (wasVerifyingRef.current) {
      emailRef.current?.focus();
    }
    wasVerifyingRef.current = verification !== null;
  }, [verification]);

  function selectMode(nextMode: Mode) {
    setMode(nextMode);
    setStatus("");
    setValidationField(null);
  }

  function handleTabKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    const nextMode = mode === "sign-in" ? "sign-up" : "sign-in";
    selectMode(nextMode);
    (nextMode === "sign-in" ? signInTabRef : signUpTabRef).current?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) {
      return;
    }

    setStatus("");
    setValidationField(null);

    const nextEmail = email.trim();
    const checkedName = validateDisplayName(name);
    if (mode === "sign-up" && !checkedName.ok) {
      setStatus(checkedName.error);
      setValidationField("name");
      nameRef.current?.focus();
      return;
    }
    if (!nextEmail) {
      setStatus("Въведи имейл.");
      setValidationField("email");
      emailRef.current?.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setStatus("Въведи валиден имейл.");
      setValidationField("email");
      emailRef.current?.focus();
      return;
    }
    if (password.length < 8) {
      setStatus("Паролата трябва да е поне 8 символа.");
      setValidationField("password");
      passwordRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const result = mode === "sign-in"
        ? await authClient.signIn.email({ email: nextEmail, password })
        : await authClient.signUp.email({
          name: checkedName.ok ? checkedName.displayName : name,
          email: nextEmail,
          password,
          callbackURL: verificationCallbackURL(redirectTo),
        });

      if (result.error) {
        if (result.error.code === "EMAIL_NOT_VERIFIED") {
          setPassword("");
          setVerification({ email: nextEmail, cooldown: 0 });
        } else {
          setStatus(mapAuthError(result.error, "Неуспешна заявка. Провери имейла и паролата."));
        }
        return;
      }

      if (mode === "sign-up" && !result.data?.token) {
        // BetterAuth intentionally returns the same pending result for an existing email.
        setPassword("");
        setVerification({ email: nextEmail, cooldown: 60 });
        return;
      }

      window.dispatchEvent(new Event("auth-session-change"));
      startTransition(() => router.push(resolveWelcomeRedirect(redirectTo)));
    } catch {
      setStatus("Не успяхме да се свържем. Провери връзката си и опитай отново.");
    } finally {
      setSubmitting(false);
    }
  }

  if (verification) {
    return (
      <section className="email-verification-pending" aria-labelledby={panelId}>
        <h2 id={panelId} ref={verificationHeadingRef} tabIndex={-1}>Провери имейла си</h2>
        <p>Отвори линка в писмото, за да потвърдиш имейла и да продължиш.</p>
        <VerificationEmailRequest initialEmail={verification.email} redirectTo={redirectTo} initialCooldownSeconds={verification.cooldown} />
        <button type="button" className="btn btn-ghost" onClick={() => {
          setVerification(null);
          selectMode("sign-in");
        }}>Към входа</button>
      </section>
    );
  }

  return (
    <form className="email-form" onSubmit={submit} noValidate>
      <div className="email-form-tabs" role="tablist" aria-label="Начин на вход" onKeyDown={handleTabKey}>
        <button
          ref={signInTabRef}
          id={signInTabId}
          type="button"
          role="tab"
          aria-selected={mode === "sign-in"}
          aria-controls={panelId}
          tabIndex={mode === "sign-in" ? 0 : -1}
          className={mode === "sign-in" ? "is-active" : ""}
          onClick={() => selectMode("sign-in")}
          disabled={isBusy}
        >
          Имам досие
        </button>
        <button
          ref={signUpTabRef}
          id={signUpTabId}
          type="button"
          role="tab"
          aria-selected={mode === "sign-up"}
          aria-controls={panelId}
          tabIndex={mode === "sign-up" ? 0 : -1}
          className={mode === "sign-up" ? "is-active" : ""}
          onClick={() => selectMode("sign-up")}
          disabled={isBusy}
        >
          Ново досие
        </button>
      </div>

      <div
        id={panelId}
        className="email-form-panel"
        role="tabpanel"
        aria-labelledby={mode === "sign-in" ? signInTabId : signUpTabId}
      >
        {mode === "sign-up" ? (
          <label htmlFor={nameId}>
            <span>Име на масата</span>
            <input ref={nameRef} id={nameId} value={name} onChange={(event) => {
              setName(event.target.value);
              if (validationField === "name") setValidationField(null);
            }} placeholder="Например: Мила" autoComplete="name" required maxLength={MAX_DISPLAY_NAME_LENGTH}
              aria-invalid={validationField === "name"}
              aria-describedby={status && validationField === "name" ? statusId : undefined} />
          </label>
        ) : null}

        <label htmlFor={emailId}>
          <span>Имейл</span>
          <input
            ref={emailRef}
            id={emailId}
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (validationField === "email") setValidationField(null);
            }}
            placeholder="ime@example.bg"
            autoComplete="email"
            aria-invalid={validationField === "email"}
            aria-describedby={status && validationField === "email" ? statusId : undefined}
            required
          />
        </label>

        <label htmlFor={passwordId}>
          <span>Парола</span>
          <input
            ref={passwordRef}
            id={passwordId}
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (validationField === "password") setValidationField(null);
            }}
            placeholder="Поне 8 символа"
            minLength={8}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            aria-invalid={validationField === "password"}
            aria-describedby={status && validationField === "password" ? statusId : undefined}
            required
          />
        </label>

        {mode === "sign-in" ? (
          <Link href={authRedirectURL("/forgot-password", redirectTo)} className="email-form-help">
            Забравена парола?
          </Link>
        ) : null}

        {status ? (
          <p id={statusId} role="alert" className="email-form-status">
            {status}
          </p>
        ) : null}

        <button className="btn btn-primary email-form-submit" type="submit" disabled={isBusy} aria-busy={isBusy}>
          {isBusy ? (mode === "sign-in" ? "Влизаме..." : "Създаваме досието...") : mode === "sign-in" ? "Влез" : "Създай досие"}
        </button>
      </div>
    </form>
  );
}
