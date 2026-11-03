"use client";

import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import type { AuthSessionView } from "@/lib/use-auth-session";
import { useModal } from "@/lib/use-modal";
import styles from "./FeedbackWidget.module.css";
import { shouldMountFeedback } from "./route-policy";

type FeedbackCategory = "bug" | "idea" | "praise" | "other";
type Status = "idle" | "submitting" | "sent" | "error";

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

function FeedbackIcon({ className }: { className?: string | undefined }) {
  return <MessageSquareText className={className} aria-hidden strokeWidth={1.7} />;
}

export function FeedbackWidget({ session }: { session: AuthSessionView }) {
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const bodyId = useId();
  const emailId = useId();
  const errorBodyId = useId();
  const panelTitleId = useId();
  const firstFieldRef = useRef<HTMLTextAreaElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const sentTitleRef = useRef<HTMLParagraphElement>(null);
  const wasOpenRef = useRef(false);
  const emailPrefilledRef = useRef(false);

  const hidden = !session.user.id || !shouldMountFeedback(pathname, true);

  const close = useCallback(() => {
    setOpen(false);
    if (status !== "submitting") {
      setStatus("idle");
      setError("");
    }
  }, [status]);
  // The modal layer includes the sibling backdrop, so isolating the page keeps it clickable.
  const { ref: layerRef } = useModal<HTMLDivElement>({ open, onClose: close });

  useEffect(() => {
    if (hidden && open) {
      close();
    }
  }, [hidden, open, close]);

  useEffect(() => {
    // The button remounts when the panel closes, so the trigger useModal remembered is already detached.
    if (wasOpenRef.current && !open) fabRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    // Prefill once per opening: a cleared optional email must stay cleared.
    if (!open) {
      emailPrefilledRef.current = false;
      return;
    }
    if (emailPrefilledRef.current) return;
    emailPrefilledRef.current = true;
    if (!email && session.user.email) setEmail(session.user.email);
  }, [email, open, session.user.email]);

  useEffect(() => {
    if (!open || hidden) return;
    const timer = window.setTimeout(() => firstFieldRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [hidden, open]);

  useEffect(() => {
    if (status !== "sent") return;

    sentTitleRef.current?.focus();
    const timer = window.setTimeout(() => {
      setOpen(false);
      setStatus("idle");
      setError("");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    const trimmedBody = body.trim();
    if (trimmedBody.length < 10) {
      setError("Кажи поне 10 символа.");
      return;
    }

    // Keep focus on a control that stays enabled while the fields lock.
    submitRef.current?.focus();
    setStatus("submitting");
    setError("");
    const emailSnapshot = email.trim();
    setSubmittedEmail(emailSnapshot);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          body: trimmedBody,
          email: emailSnapshot || null,
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
      <button ref={fabRef} type="button" className={styles.fab} onClick={() => setOpen(true)} aria-label="Дай ни бележка">
        <FeedbackIcon className={styles.fabIcon} />
      </button>
    );
  }

  return (
    <div ref={layerRef}>
      <div className={styles.overlay} aria-hidden onClick={close} />
      <aside className={styles.panel} role="dialog" aria-modal="true" aria-labelledby={panelTitleId}>
        <header className={styles.panelHead}>
          <FeedbackIcon className={styles.panelIcon} />
          <div>
            <p className={styles.kicker}>Бележка от масата</p>
            <h2 id={panelTitleId}>Дай ни бележка.</h2>
          </div>
          <button type="button" className={styles.close} onClick={close} aria-label="Затвори">
            ×
          </button>
        </header>

        {status === "sent" ? (
          <div className={styles.sent} role="status">
            <div className={styles.sentMark} aria-hidden>
              ✓
            </div>
            <p ref={sentTitleRef} className={styles.sentTitle} tabIndex={-1}>Получено. Благодарим.</p>
            <p className={styles.sentDetail}>
              {submittedEmail
                ? `Ще ти отговорим на ${submittedEmail}, ако се наложи.`
                : "Ще я прегледаме без да те търсим обратно."}
            </p>
            <p className={styles.sentHint}>Затваря автоматично...</p>
          </div>
        ) : (
          <form onSubmit={submit} className={styles.form} aria-busy={status === "submitting"}>
            <fieldset className={styles.category} disabled={status === "submitting"}>
              <legend>За какво е бележката?</legend>
              <div className={styles.categoryGrid}>
                {(Object.keys(CATEGORY_LABELS) as FeedbackCategory[]).map((key) => (
                  <label key={key} className={styles.categoryOption} data-active={category === key}>
                    <input
                      type="radio"
                      name="feedback-category"
                      value={key}
                      checked={category === key}
                      onChange={() => setCategory(key)}
                    />
                    <span className={styles.categoryLabel}>{CATEGORY_LABELS[key]}</span>
                    <span className={styles.categoryHint}>{CATEGORY_HINTS[key]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className={styles.field}>
              <label htmlFor={bodyId}>Описание</label>
              <textarea
                ref={firstFieldRef}
                id={bodyId}
                value={body}
                disabled={status === "submitting"}
                onChange={(event) => setBody(event.target.value)}
                placeholder={CATEGORY_PLACEHOLDERS[category]}
                rows={5}
                required
                minLength={10}
                maxLength={2000}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorBodyId : undefined}
              />
              <div className={styles.fieldFoot}>
                <span className={styles.fieldCount}>{body.length} / 2000</span>
                {error ? (
                  <span id={errorBodyId} className={styles.fieldError} role="alert">
                    {error}
                  </span>
                ) : null}
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor={emailId}>
                Имейл за връзка <span className={styles.fieldOptional}>(по избор)</span>
              </label>
              <input
                id={emailId}
                type="email"
                value={email}
                disabled={status === "submitting"}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ime@primer.bg"
                autoComplete="email"
              />
            </div>

            <p className={styles.context}>
              <span className={styles.contextLabel}>Изпращаш от</span>
              <code>{pathname}</code>
            </p>

            <div className={styles.actions}>
              <button ref={submitRef} type="submit" className={styles.submit} aria-disabled={status === "submitting" ? true : undefined}>
                {status === "submitting" ? "Изпращаме..." : "Изпрати"}
              </button>
              <button type="button" className={styles.cancel} onClick={close}>
                Отказ
              </button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}
