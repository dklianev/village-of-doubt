"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (!token) {
    return (
      <section className="forge-stage">
        <div className="forge-art" aria-hidden />
        <article className="forge-card">
          <h1>Невалиден линк</h1>
          <p>Този линк е празен или повреден. Заяви нов от страницата "Загубен ключ".</p>
          <Link href="/forgot-password" className="btn btn-primary">
            Заяви нов линк
          </Link>
        </article>
      </section>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

    const result = await authClient.resetPassword({ token, newPassword: password });
    if (result.error) {
      setErrorMsg(result.error.message ?? "Грешка при смяната на парола.");
      setStatus("error");
      return;
    }

    setStatus("done");
    setTimeout(() => router.push("/sign-in"), 1800);
  }

  return (
    <section className="forge-stage">
      <div className="forge-art" aria-hidden />

      <article className="forge-card">
        <header>
          <p className="forge-kicker">нов ключ</p>
          <h1>Затвори нов ключ зад себе си.</h1>
          <p className="forge-subtitle">
            Избери здрава парола - поне 8 символа. Запомни я добре, защото ще ти отваря вратата всеки път.
          </p>
        </header>

        {status === "done" ? (
          <p className="forge-success" role="status">
            Готово. Сега те водим към входа...
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

            <button type="submit" className="btn btn-primary" disabled={status === "submitting"}>
              {status === "submitting" ? "Заковавам..." : "Затвори ключа"}
            </button>
          </form>
        )}
      </article>
    </section>
  );
}
