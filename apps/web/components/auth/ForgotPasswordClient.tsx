"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const result = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: "/reset-password",
    });

    if (result.error) {
      setErrorMsg(result.error.message ?? "Грешка при заявката.");
      setStatus("error");
      return;
    }

    setStatus("sent");
  }

  return (
    <section className="locksmith-stage">
      <div className="locksmith-art" aria-hidden />

      <article className="locksmith-card">
        <header>
          <p className="locksmith-kicker">загубен ключ</p>
          <h1>Майсторим нов ключ.</h1>
          <p className="locksmith-subtitle">
            Дай имейла си - ще ти изпратим линк за нова парола. Линкът е валиден за един час.
          </p>
        </header>

        {status === "sent" ? (
          <div className="locksmith-success" role="status">
            <p>Готово. Провери имейла си.</p>
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

            <button type="submit" className="btn btn-primary" disabled={status === "submitting"}>
              {status === "submitting" ? "Изпращаме..." : "Изпрати линк"}
            </button>
          </form>
        )}

        <footer className="locksmith-foot">
          <Link href="/sign-in" className="locksmith-foot-link">
            Към входа
          </Link>
        </footer>
      </article>
    </section>
  );
}
