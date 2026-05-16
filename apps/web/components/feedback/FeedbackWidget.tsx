"use client";

import { type FormEvent, useState } from "react";
import { usePathname } from "next/navigation";

// Marketing, info, and auth-flow routes do not need product-context feedback.
// Keep matching exact so /werewolf/create and /werewolf/join/CODE still show it.
const HIDDEN_ROUTES = [
  "/",
  "/werewolf",
  "/mafia",
  "/werewolf/rules",
  "/mafia/rules",
  "/werewolf/roles",
  "/mafia/roles",
  "/roles",
  "/sign-in",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/privacy",
  "/terms",
  "/faq",
  "/status",
] as const;

function shouldHideFeedback(pathname: string): boolean {
  return HIDDEN_ROUTES.some((route) => route === pathname);
}

export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  if (shouldHideFeedback(pathname)) {
    return null;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError("");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, email: email || null, page: pathname }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Грешка при изпращане.");
        setStatus("error");
        return;
      }

      setStatus("sent");
      setBody("");
    } catch {
      setError("Грешка при изпращане.");
      setStatus("error");
    }
  }

  if (!open) {
    return (
      <button type="button" className="feedback-fab" onClick={() => setOpen(true)} aria-label="Дай ни бележка">
        💬
      </button>
    );
  }

  return (
    <aside className="feedback-panel" role="dialog" aria-label="Бележка">
      <button
        type="button"
        className="feedback-close"
        onClick={() => {
          setOpen(false);
          setStatus("idle");
        }}
        aria-label="Затвори"
      >
        ×
      </button>

      <p className="feedback-kicker">бележка</p>
      <h3>Дай ни бележка.</h3>

      {status === "sent" ? (
        <p className="feedback-sent">Получено. Благодарим.</p>
      ) : (
        <form onSubmit={submit}>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Какво харесваш, какво не? Какво се счупи?"
            rows={4}
            required
            minLength={10}
            maxLength={2000}
          />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Имейл (по избор)"
          />
          {error ? <p className="feedback-error">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={status === "submitting"}>
            {status === "submitting" ? "Изпращаме..." : "Изпрати"}
          </button>
        </form>
      )}
    </aside>
  );
}
