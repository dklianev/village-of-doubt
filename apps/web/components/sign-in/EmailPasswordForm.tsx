"use client";

import { type FormEvent, type KeyboardEvent, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { mapAuthError } from "@/lib/auth-errors";
import { resolveWelcomeRedirect } from "./welcome-redirect";

type Mode = "sign-in" | "sign-up";
type ValidationField = "email" | "password" | null;

export function EmailPasswordForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [validationField, setValidationField] = useState<ValidationField>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const statusId = useId();
  const panelId = useId();
  const signInTabId = useId();
  const signUpTabId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const signInTabRef = useRef<HTMLButtonElement>(null);
  const signUpTabRef = useRef<HTMLButtonElement>(null);
  const isBusy = isSubmitting || isPending;

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
    const nextName = name.trim();
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
    const result = await (mode === "sign-in"
      ? authClient.signIn.email({ email: nextEmail, password })
      : authClient.signUp.email({ name: nextName || nextEmail, email: nextEmail, password })).catch(() => {
      return { error: { message: "Неуспешна заявка." } };
    });

    if (result.error) {
      setStatus(mapAuthError(result.error, "Неуспешна заявка. Провери имейла и паролата."));
      setSubmitting(false);
      return;
    }

    window.dispatchEvent(new Event("auth-session-change"));
    startTransition(() => router.push(resolveWelcomeRedirect(redirectTo)));
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
            <span>Име на масата (по избор)</span>
            <input id={nameId} value={name} onChange={(event) => setName(event.target.value)} placeholder="Например: Мила" autoComplete="name" />
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
          <Link href="/forgot-password" className="email-form-help">
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
