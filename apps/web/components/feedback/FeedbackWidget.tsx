"use client";

import { type FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type FeedbackCategory = "bug" | "idea" | "praise" | "other";
type Status = "idle" | "submitting" | "sent" | "error";

// Marketing, info, formal report, and auth-flow routes do not need product-context feedback.
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
  "/report",
] as const;

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: "Бъг",
  idea: "Идея",
  praise: "Похвала",
  other: "Друго",
};

const CATEGORY_HINTS: Record<FeedbackCategory, string> = {
  bug: "Нещо не работи или се чупи.",
  idea: "Предлагаш функция или подобрение.",
  praise: "Споделяш какво харесваш.",
  other: "Не пасва в горните категории.",
};

const CATEGORY_PLACEHOLDERS: Record<FeedbackCategory, string> = {
  bug: "Какво се счупи? Кога? Как се повтаря?",
  idea: "Какво предлагаш и защо помага?",
  praise: "Какво харесваш?",
  other: "Кажи ни накратко.",
};

function shouldHideFeedback(pathname: string): boolean {
  return HIDDEN_ROUTES.some((route) => route === pathname);
}

function FeedbackIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 10 L 5 24 Q 5 26 7 26 L 25 26 Q 27 26 27 24 L 27 10" />
      <path d="M5 10 L 16 18 L 27 10" />
      <path d="M5 10 Q 5 8 7 8 L 25 8 Q 27 8 27 10" />
      <path d="M21 4 L 28 11" strokeWidth="1.8" />
      <path d="M19 5 L 21 4 L 22 6" />
      <path d="M28 11 L 26 13 L 24 11" />
    </svg>
  );
}

export function FeedbackWidget() {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const bodyId = useId();
  const emailId = useId();
  const errorBodyId = useId();
  const panelTitleId = useId();
  const firstFieldRef = useRef<HTMLTextAreaElement>(null);

  const hidden = isPending || !session || shouldHideFeedback(pathname);
  const submittedEmail = useMemo(() => email.trim(), [email]);

  const close = useCallback(() => {
    setOpen(false);
    if (status !== "submitting") {
      setStatus("idle");
      setError("");
    }
  }, [status]);

  useEffect(() => {
    if (hidden && open) {
      setOpen(false);
      setStatus("idle");
      setError("");
    }
  }, [hidden, open]);

  useEffect(() => {
    if (!open || email || !session?.user?.email) return;
    setEmail(session.user.email);
  }, [email, open, session?.user?.email]);

  useEffect(() => {
    if (!open || hidden) return;
    const timer = window.setTimeout(() => firstFieldRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [hidden, open]);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, open]);

  useEffect(() => {
    if (status !== "sent") return;

    const timer = window.setTimeout(() => {
      setOpen(false);
      setStatus("idle");
      setError("");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedBody = body.trim();
    if (trimmedBody.length < 10) {
      setError("Кажи поне 10 символа.");
      return;
    }

    setStatus("submitting");
    setError("");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          body: trimmedBody,
          email: email.trim() || null,
          page: pathname,
        }),
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

  if (hidden) {
    return null;
  }

  if (!open) {
    return (
      <button type="button" className="feedback-fab" onClick={() => setOpen(true)} aria-label="Дай ни бележка">
        <FeedbackIcon className="feedback-fab-icon" />
      </button>
    );
  }

  return (
    <>
      <div className="feedback-overlay" aria-hidden onClick={close} />
      <aside className="feedback-panel" role="dialog" aria-modal="true" aria-labelledby={panelTitleId}>
        <header className="feedback-panel-head">
          <FeedbackIcon className="feedback-panel-icon" />
          <div>
            <p className="feedback-kicker">бележка от масата</p>
            <h2 id={panelTitleId}>Дай ни бележка.</h2>
          </div>
          <button type="button" className="feedback-close" onClick={close} aria-label="Затвори">
            ×
          </button>
        </header>

        {status === "sent" ? (
          <div className="feedback-sent" role="status">
            <div className="feedback-sent-mark" aria-hidden>
              ✓
            </div>
            <p className="feedback-sent-title">Получено. Благодарим.</p>
            <p className="feedback-sent-detail">
              {submittedEmail
                ? `Ще ти отговорим на ${submittedEmail}, ако се наложи.`
                : "Ще я прегледаме без да те търсим обратно."}
            </p>
            <p className="feedback-sent-hint">Затваря автоматично...</p>
          </div>
        ) : (
          <form onSubmit={submit} className="feedback-form">
            <fieldset className="feedback-category">
              <legend>За какво е бележката?</legend>
              <div className="feedback-category-grid">
                {(Object.keys(CATEGORY_LABELS) as FeedbackCategory[]).map((key) => (
                  <label key={key} className="feedback-category-option" data-active={category === key}>
                    <input
                      type="radio"
                      name="feedback-category"
                      value={key}
                      checked={category === key}
                      onChange={() => setCategory(key)}
                    />
                    <span className="feedback-category-label">{CATEGORY_LABELS[key]}</span>
                    <span className="feedback-category-hint">{CATEGORY_HINTS[key]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="feedback-field">
              <label htmlFor={bodyId}>Описание</label>
              <textarea
                ref={firstFieldRef}
                id={bodyId}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={CATEGORY_PLACEHOLDERS[category]}
                rows={5}
                required
                minLength={10}
                maxLength={2000}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorBodyId : undefined}
              />
              <div className="feedback-field-foot">
                <span className="feedback-field-count">{body.length} / 2000</span>
                {error ? (
                  <span id={errorBodyId} className="feedback-field-error" role="alert">
                    {error}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="feedback-field">
              <label htmlFor={emailId}>
                Имейл за връзка <span className="feedback-field-optional">(по избор)</span>
              </label>
              <input
                id={emailId}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="example@domain.com"
                autoComplete="email"
              />
            </div>

            <p className="feedback-context">
              <span className="feedback-context-label">Изпращаш от</span>
              <code>{pathname}</code>
            </p>

            <div className="feedback-actions">
              <button type="submit" className="feedback-submit" disabled={status === "submitting"}>
                {status === "submitting" ? "Изпращаме..." : "Изпрати"}
              </button>
              <button type="button" className="feedback-cancel" onClick={close}>
                Отказ
              </button>
            </div>
          </form>
        )}
      </aside>
    </>
  );
}
