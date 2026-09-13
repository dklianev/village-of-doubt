"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { mapAuthError } from "@/lib/auth-errors";
import { authRedirectURL } from "./verification-callback";

export function ForgotPasswordClient() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const signInHref = authRedirectURL("/sign-in", redirectTo);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMsg("");

    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: authRedirectURL("/reset-password", redirectTo),
      });
      if (result.error) {
        setErrorMsg(mapAuthError(result.error, "Заявката не беше приета. Опитай отново след малко."));
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setErrorMsg("Не успяхме да се свържем. Провери връзката си и опитай отново.");
      setStatus("error");
    }
  }

  return (
    <section className="locksmith-stage">
      <div className="locksmith-art" aria-hidden />

      <article className="locksmith-card">
        <header>
          <span className="auth-recovery-icon" aria-hidden>
            <KeyRound strokeWidth={1.8} />
          </span>
          <p className="locksmith-kicker">загубен ключ</p>
          <h1>Забравена парола</h1>
          <p className="locksmith-subtitle">
            Дай имейла си - ще ти изпратим линк за нова парола. Линкът е валиден за един час.
          </p>
        </header>

        {status === "sent" ? (
          <div className="locksmith-success" role="status">
            <p>Ако има досие с този имейл, ще получиш линк за нова парола.</p>
            <p className="locksmith-success-hint">Не виждаш писмото? Провери в "Спам" или "Промоции".</p>
          </div>
        ) : (
          <form onSubmit={submit} className="locksmith-form">
            <label>
              <span>Имейл</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ime@example.bg"
                autoComplete="email"
                required
              />
            </label>

            {errorMsg ? (
              <p className="locksmith-error" role="alert">
                {errorMsg}
              </p>
            ) : null}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={status === "submitting"}
              aria-busy={status === "submitting"}
            >
              {status === "submitting" ? "Изпращаме..." : "Изпрати линк"}
            </button>
          </form>
        )}

        <footer className="locksmith-foot">
          <Link href={signInHref} className="locksmith-foot-link">
            Към входа
          </Link>
        </footer>
      </article>
    </section>
  );
}
