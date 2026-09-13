"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { safeInternalRedirect } from "@/lib/safe-internal-redirect";
import { resolveWelcomeRedirect } from "@/components/sign-in/welcome-redirect";
import { VerificationEmailRequest } from "./VerificationEmailRequest";

type VerifyState = "idle" | "verifying" | "success" | "error";
type VerificationResult = { verified: boolean; error?: string; email?: string };

async function checkVerification(token: string, callbackError: string): Promise<VerificationResult> {
  if (callbackError) {
    return { verified: false, error: "Линкът е изтекъл или невалиден. Заяви нов линк по-долу." };
  }
  try {
    if (token) {
      const result = await authClient.verifyEmail({ query: { token } });
      return result.error
        ? { verified: false, error: "Линкът е изтекъл или невалиден. Заяви нов линк по-долу." }
        : { verified: true };
    }
    // Email links verify on the server, set the session cookie, then reach this callback.
    const result = await authClient.getSession();
    if (result.error) {
      return { verified: false, error: "Не успяхме да проверим потвърждението. Опитай отново след малко." };
    }
    return result.data?.user.emailVerified
      ? { verified: true }
      : {
        verified: false,
        ...(result.data?.user.email ? { email: result.data.user.email } : {}),
        error: "Линкът за потвърждение липсва или е невалиден. Заяви нов линк по-долу.",
      };
  } catch {
    return { verified: false, error: "Не успяхме да се свържем. Провери връзката си и опитай отново." };
  }
}

export function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const callbackError = searchParams.get("error") ?? "";
  const redirectTo = safeInternalRedirect(searchParams.get("redirect"));

  const [state, setState] = useState<VerifyState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [initialEmail, setInitialEmail] = useState("");
  const [destination, setDestination] = useState(redirectTo);
  const requestRef = useRef<{ key: string; promise: Promise<VerificationResult> } | null>(null);

  useEffect(() => {
    let active = true;
    setState("verifying");
    const key = JSON.stringify([token, callbackError]);
    if (requestRef.current?.key !== key) {
      requestRef.current = { key, promise: checkVerification(token, callbackError) };
    }
    requestRef.current.promise.then((result) => {
      if (!active) return;
      if (result.verified) {
        setDestination(resolveWelcomeRedirect(redirectTo));
        setState("success");
        window.dispatchEvent(new Event("auth-session-change"));
      } else {
        setInitialEmail(result.email ?? "");
        setErrorMsg(result.error ?? "Потвърждението не е завършено. Заяви нов линк.");
        setState("error");
      }
    });
    return () => { active = false; };
  }, [token, callbackError, redirectTo]);

  useEffect(() => {
    if (state !== "success") {
      return;
    }

    const timer = window.setTimeout(() => router.push(destination), 6000);
    return () => window.clearTimeout(timer);
  }, [router, state, destination]);

  const headline = state === "success"
    ? "Имейлът е потвърден."
    : state === "error"
      ? "Потвърждението не е завършено."
      : "Потвърждаваме имейла...";

  return (
    <section className="seal-stage">
      <figure className="seal-art" aria-hidden />

      <article className="seal-card">
        <span className="auth-recovery-icon" aria-hidden>
          <MailCheck strokeWidth={1.8} />
        </span>
        <p className="seal-kicker">потвърждение</p>
        <h1>{headline}</h1>

        {state === "verifying" || state === "idle" ? <p className="seal-body" role="status">Проверяваме потвърждението. Изчакай малко.</p> : null}

        {state === "success" ? (
          <div role="status" aria-live="polite" aria-atomic="true">
            <p className="seal-body">Имейлът е потвърден. Можеш да продължиш.</p>
            <p className="seal-hint">След малко ще продължиш автоматично.</p>
            <div className="seal-actions">
              <Link href={destination} className="btn btn-primary">
                Продължи
              </Link>
            </div>
          </div>
        ) : null}

        {state === "error" ? (
          <>
            <p className="seal-error" role="alert">
              {errorMsg}
            </p>
            <VerificationEmailRequest initialEmail={initialEmail} redirectTo={redirectTo} />
            <div className="seal-actions">
              <Link href={`/sign-in?${new URLSearchParams({ redirect: redirectTo })}`} className="btn btn-secondary">
                Към входа
              </Link>
            </div>
          </>
        ) : null}
      </article>
    </section>
  );
}
