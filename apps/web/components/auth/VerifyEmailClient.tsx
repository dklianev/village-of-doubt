"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type VerifyState = "idle" | "verifying" | "success" | "error";

export function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [state, setState] = useState<VerifyState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMsg("Този линк е празен или повреден.");
      return;
    }

    setState("verifying");

    authClient
      .verifyEmail({ query: { token } })
      .then((result) => {
        if (result.error) {
          setErrorMsg(result.error.message ?? "Линкът вече е използван или изтекъл.");
          setState("error");
          return;
        }
        setState("success");
        setTimeout(() => router.push("/"), 2000);
      })
      .catch((error) => {
        console.error("[verify-email]", error);
        setErrorMsg("Грешка при потвърждение.");
        setState("error");
      });
  }, [token, router]);

  return (
    <section className="seal-stage">
      <figure className="seal-art" aria-hidden />

      <article className="seal-card">
        <p className="seal-kicker">потвърждение</p>
        <h1>{state === "success" ? "Печатът е поставен." : "Притискаме печата..."}</h1>

        {state === "verifying" || state === "idle" ? <p className="seal-body">Восъкът се втвърдява. Изчакай миг.</p> : null}

        {state === "success" ? (
          <>
            <p className="seal-body">Имейлът е потвърден. Сега си на масата.</p>
            <p className="seal-hint">Водим те към началото...</p>
          </>
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
