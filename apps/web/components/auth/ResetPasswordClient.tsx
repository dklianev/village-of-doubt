"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeySquare } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { mapAuthError } from "@/lib/auth-errors";
import { authRedirectURL } from "./verification-callback";

export function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const redirectTo = searchParams.get("redirect");
  const signInHref = authRedirectURL("/sign-in", redirectTo);
  const forgotHref = authRedirectURL("/forgot-password", redirectTo);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (status !== "done") {
      return;
    }

    const timer = window.setTimeout(() => router.push(signInHref), 1800);
    return () => window.clearTimeout(timer);
  }, [router, status, signInHref]);

  if (!token) {
    return (
      <section className="forge-stage">
        <div className="forge-art" aria-hidden />
        <article className="forge-card">
          <h1>Невалиден линк</h1>
          <p>Този линк е невалиден или е изтекъл. Заяви нов линк за смяна на паролата.</p>
          <Link href={forgotHref} className="btn btn-primary">
            Заяви нов линк
          </Link>
          <footer className="forge-foot">
            <Link href={signInHref}>Към входа</Link>
          </footer>
        </article>
      </section>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    setErrorMsg("");

    if (password.length < 8) {
      setErrorMsg("Паролата трябва да е поне 8 символа.");
      setStatus("error");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("Двете полета трябва да съвпадат.");
      setStatus("error");
      return;
    }

    setStatus("submitting");

    try {
      const result = await authClient.resetPassword({ token, newPassword: password });
      if (result.error) {
        setErrorMsg(mapAuthError(result.error, "Паролата не е сменена. Опитай отново или заяви нов линк."));
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setErrorMsg("Не успяхме да се свържем. Провери връзката си и опитай отново.");
      setStatus("error");
    }
  }

  return (
    <section className="forge-stage">
      <div className="forge-art" aria-hidden />

      <article className="forge-card">
        <header>
          <span className="auth-recovery-icon" aria-hidden>
            <KeySquare strokeWidth={1.8} />
          </span>
          <p className="forge-kicker">нов ключ</p>
          <h1>Нова парола</h1>
          <p className="forge-subtitle">
            Използвай поне 8 символа и парола, която не ползваш другаде.
          </p>
        </header>

        {status === "done" ? (
          <p className="forge-success" role="status">
            Паролата е сменена. Сега те водим към входа...
          </p>
        ) : (
          <form onSubmit={submit} className="forge-form">
            <label>
              <span>Нова парола</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Поне 8 символа"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </label>
            <label>
              <span>Повтори</span>
              <input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="Същата парола"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </label>

            {errorMsg ? (
              <p className="forge-error" role="alert">
                {errorMsg}
              </p>
            ) : null}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={status === "submitting"}
              aria-busy={status === "submitting"}
            >
              {status === "submitting" ? "Запазваме..." : "Запази паролата"}
            </button>
            {status === "error" ? <Link href={forgotHref}>Заяви нов линк</Link> : null}
          </form>
        )}
        <footer className="forge-foot">
          <Link href={signInHref}>Към входа</Link>
        </footer>
      </article>
    </section>
  );
}
