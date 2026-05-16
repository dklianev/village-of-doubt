"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";

type ReportType = "abuse" | "copyright" | "bug" | "other";

const TYPE_LABELS: Record<ReportType, string> = {
  abuse: "Неуместно поведение / тормоз",
  copyright: "Авторски права",
  bug: "Технически проблем",
  other: "Друго",
};

export function ReportClient() {
  const [type, setType] = useState<ReportType>("abuse");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [evidence, setEvidence] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, body, email: email || null, evidence: evidence || null }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(data.error ?? "Грешка при изпращане.");
        setStatus("error");
        return;
      }

      setStatus("sent");
    } catch {
      setErrorMsg("Грешка при изпращане.");
      setStatus("error");
    }
  }

  return (
    <section className="lighthouse-stage">
      <div className="lighthouse-art" aria-hidden />

      <article className="lighthouse-card">
        <header>
          <p className="lighthouse-kicker">сигнал</p>
          <h1>Светим за тебе.</h1>
          <p className="lighthouse-subtitle">
            Ако нещо не е наред - играч с неуместно поведение, спорно съдържание или нарушение на
            авторски права - кажи ни. Преглеждаме сигнали в рамките на 48 часа.
          </p>
        </header>

        {status === "sent" ? (
          <div className="lighthouse-success" role="status">
            <p>Сигналът е получен.</p>
            <p className="lighthouse-success-hint">Ще го прегледаме и ще ти отговорим, ако си посочил имейл.</p>
            <Link href="/" className="btn btn-secondary">
              Към началото
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="lighthouse-form">
            <label>
              <span>Тип сигнал</span>
              <select value={type} onChange={(event) => setType(event.target.value as ReportType)}>
                {(Object.keys(TYPE_LABELS) as ReportType[]).map((key) => (
                  <option key={key} value={key}>
                    {TYPE_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Описание</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Какво се случи? Кога? Кой?"
                rows={5}
                required
                minLength={20}
                maxLength={4000}
              />
            </label>

            <label>
              <span>Доказателство (по избор)</span>
              <input
                type="text"
                value={evidence}
                onChange={(event) => setEvidence(event.target.value)}
                placeholder="Линк, код на стая или адрес към снимка"
              />
            </label>

            <label>
              <span>Твоят имейл (по избор, за отговор)</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ime@example.bg"
              />
            </label>

            {errorMsg ? (
              <p className="lighthouse-error" role="alert">
                {errorMsg}
              </p>
            ) : null}

            <button type="submit" className="btn btn-primary" disabled={status === "submitting"}>
              {status === "submitting" ? "Изпращаме..." : "Изпрати сигнал"}
            </button>
          </form>
        )}
      </article>
    </section>
  );
}
