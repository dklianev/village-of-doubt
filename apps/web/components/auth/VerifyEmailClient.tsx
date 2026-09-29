"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { safeInternalRedirect } from "@/lib/safe-internal-redirect";
import { resolveWelcomeRedirect } from "@/components/sign-in/welcome-redirect";
import { VerificationEmailRequest } from "./VerificationEmailRequest";
import { authRedirectURL } from "./verification-callback";
import type { RecoveryIcons } from "./RecoveryIcons";

type VerifyState = "verifying" | "success" | "invalid" | "network-error";
type VerificationResult =
  | { state: "success" }
  | { state: "invalid" | "network-error"; error: string; email?: string };

const TRANSIENT_ERROR = "Не успяхме да проверим имейла. Провери връзката си и опитай отново.";

async function checkVerification(token: string, callbackError: string): Promise<VerificationResult> {
  if (callbackError) {
    return { state: "invalid", error: "Линкът е изтекъл или невалиден. Заяви нов линк." };
  }
  try {
    if (token) {
      const result = await authClient.verifyEmail({ query: { token } });
      if (!result.error) return { state: "success" };
      const { code, status } = result.error;
      if (status === 408 || status === 429 || status >= 500) {
        return { state: "network-error", error: TRANSIENT_ERROR };
      }
      // Permanent token failures share neutral recovery, including missing or mismatched users.
      return (status >= 400 && status < 500)
        || code === "INVALID_TOKEN" || code === "TOKEN_EXPIRED"
        || code === "USER_NOT_FOUND" || code === "INVALID_USER"
        ? { state: "invalid", error: "Линкът е изтекъл или невалиден. Заяви нов линк." }
        : { state: "network-error", error: TRANSIENT_ERROR };
    }
    // Email links verify on the server, set the session cookie, then reach this callback.
    const result = await authClient.getSession();
    if (result.error) return { state: "network-error", error: TRANSIENT_ERROR };
    return result.data?.user.emailVerified
      ? { state: "success" }
      : {
        state: "invalid",
        ...(result.data?.user.email ? { email: result.data.user.email } : {}),
        error: "Линкът за потвърждение липсва или е невалиден. Заяви нов линк.",
      };
  } catch {
    return { state: "network-error", error: TRANSIENT_ERROR };
  }
}

export function VerifyEmailClient({ icons }: {
  icons: Pick<RecoveryIcons, "header" | "retry" | "send" | "back" | "forward">;
}) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const callbackError = searchParams.get("error") ?? "";
  const redirectTo = safeInternalRedirect(searchParams.get("redirect"));

  const [state, setState] = useState<VerifyState>("verifying");
  const [errorMsg, setErrorMsg] = useState("");
  const [initialEmail, setInitialEmail] = useState("");
  const [destination, setDestination] = useState(redirectTo);
  const [attempt, setAttempt] = useState(0);
  const requestRef = useRef<{ key: string; promise: Promise<VerificationResult> } | null>(null);
  const pending = useRef(false);
  const id = useId();

  useEffect(() => {
    let active = true;
    pending.current = true;
    setState("verifying");
    const key = JSON.stringify([token, callbackError, attempt]);
    if (requestRef.current?.key !== key) {
      requestRef.current = { key, promise: checkVerification(token, callbackError) };
    }
    requestRef.current.promise.then((result) => {
      if (!active) return;
      pending.current = false;
      if (result.state === "success") {
        setDestination(resolveWelcomeRedirect(redirectTo));
        setState("success");
        window.dispatchEvent(new Event("auth-session-change"));
      } else {
        setInitialEmail(result.email ?? "");
        setErrorMsg(result.error);
        setState(result.state);
      }
    });
    return () => { active = false; };
  }, [token, callbackError, redirectTo, attempt]);

  function retry() {
    if (pending.current || state !== "network-error") return;
    pending.current = true;
    setState("verifying");
    setAttempt((value) => value + 1);
  }

  const headline = state === "success"
    ? "Имейлът е потвърден."
    : state === "invalid"
      ? "Невалиден линк"
      : state === "network-error"
        ? "Проверката не завърши"
        : "Потвърждаваме имейла...";

  return (
    <section className="recovery-panel" aria-labelledby={`${id}-heading`}>
      <header className="recovery-header">
        <span className="recovery-icon" aria-hidden="true">{icons.header}</span>
        <p className="recovery-kicker">Потвърждение на имейла</p>
        <h1 id={`${id}-heading`}>{headline}</h1>
      </header>

      {state === "verifying" ? (
        <p className="recovery-copy" role="status">Проверяваме потвърждението. Изчакай малко.</p>
      ) : null}

      {state === "success" ? (
        <>
          <p className="recovery-success" role="status">Имейлът е потвърден. Можеш да продължиш.</p>
          <div className="recovery-actions">
            <Link href={destination} className="btn btn-primary">Продължи{icons.forward}</Link>
          </div>
        </>
      ) : null}

      {state === "invalid" || state === "network-error" ? (
        <>
          <p className="recovery-error" role="alert">{errorMsg}</p>
          {state === "invalid" ? (
            <VerificationEmailRequest initialEmail={initialEmail} redirectTo={redirectTo} variant="primary" sendIcon={icons.send} />
          ) : (
            <div className="recovery-actions">
              <button type="button" className="btn btn-primary" onClick={retry}>
                {icons.retry}Опитай отново
              </button>
            </div>
          )}
          <footer className="recovery-footer">
            <Link href={authRedirectURL("/sign-in", redirectTo)} className="recovery-link">
              {icons.back}Към входа
            </Link>
          </footer>
        </>
      ) : null}
    </section>
  );
}
