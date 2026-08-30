"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { mapAuthError } from "@/lib/auth-errors";

type VerifyState = "idle" | "verifying" | "success" | "error";

export function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [state, setState] = useState<VerifyState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const submittedTokenRef = useRef("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMsg("Този линк е празен или повреден.");
      return;
    }

    if (submittedTokenRef.current === token) {
      return;
    }
    submittedTokenRef.current = token;

    setState("verifying");

    authClient
      .verifyEmail({ query: { token } })
      .then((result) => {
        if (result.error) {
          setErrorMsg(mapAuthError(result.error, "Линкът вече е използван или изтекъл."));
          setState("error");
          return;
        }
        setState("success");
      })
      .catch((error) => {
        console.error("[verify-email]", error);
        setErrorMsg("Грешка при потвърждение.");
        setState("error");
      });
  }, [token]);

  useEffect(() => {
    if (state !== "success") {
      return;
    }

    const timer = window.setTimeout(() => router.push("/"), 6000);
    return () => window.clearTimeout(timer);
  }, [router, state]);

  const headline = state === "success"
    ? "Печатът е поставен."
    : state === "error"
      ? "Печатът не беше поставен."
      : "Притискаме печата...";

  return (
    <section className="seal-stage">
      <figure className="seal-art" aria-hidden />

      <article className="seal-card">
        <span className="auth-recovery-icon" aria-hidden>
          <MailCheck strokeWidth={1.8} />
        </span>
        <p className="seal-kicker">потвърждение</p>
        <h1>{headline}</h1>

        {state === "verifying" || state === "idle" ? <p className="seal-body">Восъкът се втвърдява. Изчакай миг.</p> : null}

        {state === "success" ? (
          <div role="status" aria-live="polite" aria-atomic="true">
            <p className="seal-body">Имейлът е потвърден. Сега си на масата.</p>
            <p className="seal-hint">След малко ще те отведем към началото.</p>
            <div className="seal-actions">
              <Link href="/" className="btn btn-primary">
                Към началото
              </Link>
            </div>
          </div>
        ) : null}

        {state === "error" ? (
          <>
            <p className="seal-error" role="alert">
              {errorMsg}
            </p>
            <div className="seal-actions">
              <Link href="/sign-in" className="btn btn-secondary">
                Към входа
              </Link>
            </div>
          </>
        ) : null}
      </article>
    </section>
  );
}
