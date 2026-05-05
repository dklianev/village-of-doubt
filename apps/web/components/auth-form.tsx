"use client";

import { FormEvent, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type AuthMode = "sign-in" | "sign-up";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
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

    const action =
      mode === "sign-in"
        ? authClient.signIn.email({ email, password })
        : authClient.signUp.email({ name: name || email, email, password });

    const result = await action;
    if (result.error) {
      setStatus(result.error.message ?? "Неуспешна заявка.");
      return;
    }

    startTransition(() => router.push("/lobby"));
  }

  return (
    <form className="auth-form mt-7 grid gap-4" onSubmit={submit}>
      <div className="auth-mode-switch" aria-label="Избор между вход и регистрация">
        <button
          className={mode === "sign-in" ? "is-active" : ""}
          type="button"
          onClick={() => setMode("sign-in")}
        >
          Вход
        </button>
        <button
          className={mode === "sign-up" ? "is-active" : ""}
          type="button"
          onClick={() => setMode("sign-up")}
        >
          Регистрация
        </button>
      </div>
      {mode === "sign-up" ? (
        <div className="grid gap-1">
          <label htmlFor={nameId} className="text-xs font-bold uppercase tracking-[0.2em] text-[#842f2b]">
            Име
          </label>
          <input
            id={nameId}
            className="input auth-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Име"
            autoComplete="name"
          />
        </div>
      ) : null}
      <div className="grid gap-1">
        <label htmlFor={emailId} className="text-xs font-bold uppercase tracking-[0.2em] text-[#842f2b]">
          Имейл
        </label>
        <input
          id={emailId}
          className="input auth-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="example@domain.com"
          type="email"
          autoComplete={mode === "sign-in" ? "email" : "email"}
          required
        />
      </div>
      <div className="grid gap-1">
        <label htmlFor={passwordId} className="text-xs font-bold uppercase tracking-[0.2em] text-[#842f2b]">
          Парола
        </label>
        <input
          id={passwordId}
          className="input auth-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Поне 8 символа"
          type="password"
          minLength={8}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          aria-describedby={status ? statusId : undefined}
          required
        />
      </div>
      {status ? (
        <p id={statusId} role="alert" aria-live="assertive" className="rounded-2xl bg-[#842f2b]/10 p-3 text-sm font-bold text-[#842f2b]">
          {status}
        </p>
      ) : null}
      <button className="btn btn-primary" type="submit" disabled={isPending}>
        {mode === "sign-in" ? "Влез" : "Създай профил"}
      </button>
      <button
        className="text-sm font-bold text-[#842f2b]"
        type="button"
        onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
      >
        {mode === "sign-in" ? "Нямаш профил? Регистрирай се" : "Имаш профил? Влез"}
      </button>
    </form>
  );
}
