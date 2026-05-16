"use client";

import { type FormEvent, useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";

export function EmailPasswordForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const statusId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    const nextEmail = email.trim();
    const nextName = name.trim();
    if (!nextEmail) {
      setStatus("Въведи имейл.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setStatus("Въведи валиден имейл.");
      return;
    }
    if (password.length < 8) {
      setStatus("Паролата трябва да е поне 8 символа.");
      return;
    }

    const result = await (mode === "sign-in"
      ? authClient.signIn.email({ email: nextEmail, password })
      : authClient.signUp.email({ name: nextName || nextEmail, email: nextEmail, password })).catch(() => {
      return { error: { message: "Неуспешна заявка." } };
    });

    if (result.error) {
      setStatus("Неуспешна заявка. Провери имейла и паролата.");
      return;
    }

    window.dispatchEvent(new Event("auth-session-change"));
    startTransition(() => router.push(redirectTo));
  }

  return (
    <form className="email-form" onSubmit={submit} noValidate>
      <div className="email-form-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "sign-in"}
          className={mode === "sign-in" ? "is-active" : ""}
          onClick={() => setMode("sign-in")}
        >
          Имам профил
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "sign-up"}
          className={mode === "sign-up" ? "is-active" : ""}
          onClick={() => setMode("sign-up")}
        >
          Нов профил
        </button>
      </div>

      {mode === "sign-up" ? (
        <label htmlFor={nameId}>
          <span>Име на масата</span>
          <input id={nameId} value={name} onChange={(event) => setName(event.target.value)} placeholder="Например: Мила" autoComplete="name" />
        </label>
      ) : null}

      <label htmlFor={emailId}>
        <span>Имейл</span>
        <input
          id={emailId}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ime@example.bg"
          autoComplete="email"
          required
        />
      </label>

      <label htmlFor={passwordId}>
        <span>Парола</span>
        <input
          id={passwordId}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Поне 8 символа"
          minLength={8}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          aria-describedby={status ? statusId : undefined}
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

      <button className="btn btn-primary email-form-submit" type="submit" disabled={isPending}>
        {mode === "sign-in" ? "Влез" : "Създай профил"}
      </button>
    </form>
  );
}
