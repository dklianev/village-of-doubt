"use client";

import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState, useTransition } from "react";
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

export function EmailPasswordForm({
  redirectTo,
  intro,
  registrationIntro,
  icons,
  children,
}: {
  redirectTo: string;
  intro?: ReactNode;
  registrationIntro?: ReactNode;
  icons?: { showPassword: ReactNode; hidePassword: ReactNode; submit: ReactNode };
  children?: ReactNode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
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
    if (isBusy) return;
    if (nameRef.current) setName(nameRef.current.value);
    setMode(nextMode);
    setPasswordVisible(false);
    setStatus("");
    setValidationField(null);
  }

  function handleTabKey(event: KeyboardEvent<HTMLDivElement>) {
    if (isBusy || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const nextMode = event.key === "Home" ? "sign-in"
      : event.key === "End" ? "sign-up"
        : mode === "sign-in" ? "sign-up" : "sign-in";
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

    // The DOM owns editable values, including input before hydration and silent autofill.
    const formData = new FormData(event.currentTarget);
    const nextEmail = String(formData.get("email") ?? "").trim();
    const nextName = String(formData.get("name") ?? "");
    const password = String(formData.get("password") ?? "");
    const checkedName = validateDisplayName(nextName);
    setEmail(nextEmail);
    if (mode === "sign-up") setName(nextName);
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
          name: checkedName.ok ? checkedName.displayName : nextName,
          email: nextEmail,
          password,
          callbackURL: verificationCallbackURL(redirectTo),
        });

      if (result.error) {
        if (result.error.code === "EMAIL_NOT_VERIFIED") {
          setVerification({ email: nextEmail, cooldown: 0 });
        } else {
          setStatus(mapAuthError(result.error, "Неуспешна заявка. Провери имейла и паролата."));
        }
        return;
      }

      if (mode === "sign-up" && !result.data?.token) {
        // BetterAuth intentionally returns the same pending result for an existing email.
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
        <h1 id={panelId} ref={verificationHeadingRef} tabIndex={-1}>Провери имейла си</h1>
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
    <form className="email-form" method="post" onSubmit={submit} noValidate>
      <div className="email-form-intro">
        <div aria-hidden={mode !== "sign-in"}>{intro}</div>
        <div aria-hidden={mode !== "sign-up"}>{registrationIntro}</div>
      </div>
      <div className="email-form-tabs" role="tablist" aria-label="Начин на вход" onKeyDown={handleTabKey}>
        {(["sign-in", "sign-up"] as const).map((tab) => (
          <button
            key={tab}
            ref={tab === "sign-in" ? signInTabRef : signUpTabRef}
            id={tab === "sign-in" ? signInTabId : signUpTabId}
            type="button"
            role="tab"
            aria-selected={mode === tab}
            aria-controls={panelId}
            tabIndex={mode === tab ? 0 : -1}
            className={mode === tab ? "is-active" : ""}
            onClick={() => selectMode(tab)}
            disabled={isBusy}
          >
            {tab === "sign-in" ? "Вход" : "Регистрация"}
          </button>
        ))}
      </div>

      <div
        id={panelId}
        className="email-form-panel"
        role="tabpanel"
        aria-labelledby={mode === "sign-in" ? signInTabId : signUpTabId}
      >
        <fieldset className="sign-in-oauth" disabled={isBusy} aria-label="Вход с Google или Discord">{children}</fieldset>
        <div className="sign-in-divider" role="separator" aria-label="или с имейл"><span>или с имейл</span></div>
        {mode === "sign-up" ? (
          <label htmlFor={nameId}>
            <span>Име на масата</span>
            <input ref={nameRef} id={nameId} name="name" defaultValue={name} onChange={() => {
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
            name="email"
            type="email"
            defaultValue={email}
            onChange={() => {
              if (validationField === "email") setValidationField(null);
            }}
            placeholder="ime@example.bg"
            autoComplete="email"
            aria-invalid={validationField === "email"}
            aria-describedby={status && validationField === "email" ? statusId : undefined}
            required
          />
        </label>

        <div className="email-password-field">
          <div className="email-password-label">
            <label htmlFor={passwordId}>Парола</label>
            {mode === "sign-in" ? (
              <Link href={authRedirectURL("/forgot-password", redirectTo)} className="email-form-help">
                Забравена парола?
              </Link>
            ) : null}
          </div>
          <div className="email-password-input">
            <input
              ref={passwordRef}
              id={passwordId}
              name="password"
              type={passwordVisible ? "text" : "password"}
              onChange={() => {
                if (validationField === "password") setValidationField(null);
              }}
              placeholder={mode === "sign-up" ? "Поне 8 символа" : "Твоята парола"}
              minLength={8}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              aria-invalid={validationField === "password"}
              aria-describedby={status && validationField === "password" ? statusId : undefined}
              required
            />
            <button type="button" className="email-password-toggle"
              aria-label={passwordVisible ? "Скрий паролата" : "Покажи паролата"}
              title={passwordVisible ? "Скрий паролата" : "Покажи паролата"}
              aria-controls={passwordId}
              onClick={() => setPasswordVisible((visible) => !visible)}>
              {passwordVisible ? icons?.hidePassword : icons?.showPassword}
            </button>
          </div>
        </div>

        {status ? (
          <p id={statusId} role="alert" className="email-form-status">
            {status}
          </p>
        ) : null}

        <button className="btn btn-primary email-form-submit" type="submit" disabled={isBusy} aria-busy={isBusy}>
          <span>{isBusy ? (mode === "sign-in" ? "Влизаме..." : "Създаваме профила...") : mode === "sign-in" ? "Влез" : "Създай профил"}</span>
          {icons?.submit}
        </button>
      </div>
    </form>
  );
}
