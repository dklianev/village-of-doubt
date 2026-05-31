# Codex prompt — FeedbackWidget complete overhaul

Цялостен redesign на floating feedback widget:
- **Icon redesign** — заменя 💬 emoji с inline SVG в site стилистика
- **Panel redesign** — преминаване от heavy brass texture към clean legal-modern aesthetic (съвпада с новия design system от `codex-prompt-legal-faq-modern-overhaul.md`)
- **Category selector** — нов "Бъг / Идея / Похвала / Друго" segmented control за по-добра operator triage
- **Visibility scope refinement** — допълва earlier `codex-prompt-footer-and-fab-polish.md`, добавя authenticated-only requirement
- **Backend update** — API + email template получават category поле
- **Form UX modernization** — character counter, inline validation, success celebration

~10 atomic English commits. Branch: `feat/feedback-widget-overhaul`. **No new imagen assets** — inline SVG + typography е по-modern за floating widget.

---

## Pre-analysis (current state)

### Visual problems (от user screenshot)

| # | Issue | Severity |
|---|---|---|
| 1 | **Heavy gold/brass background texture** — изглежда като vBulletin форум от 2005-та | 🔴 |
| 2 | **6px inset brass borders** — old-school chrome-like effect, не современен | 🟠 |
| 3 | **💬 emoji icon на FAB** — rendering varies by OS, no character, harsh contrast с brass orb около него | 🟠 |
| 4 | **Plain unstyled textarea + email input** — cream cushions без affordance, без focus styling | 🟠 |
| 5 | **Single big red "ИЗПРАТИ" pill бутон** — visual weight несъразмерен с form-а | 🟡 |
| 6 | **Без category** — operator получава "anonymous note about /werewolf/create" без знание дали е бъг, идея или похвала | 🟠 |
| 7 | **Без character counter** — потребителят не знае колко може да напише | 🟡 |
| 8 | **Анонимен success state** — само "Получено. Благодарим." без обратна връзка какво се случва нататък | 🟡 |
| 9 | **Visibility scope** — earlier prompt дефинира HIDDEN_ROUTES, но няма authenticated-only constraint | 🟡 |

### Why redesign matters

FAB widget е едно от **малкото persistent UI elements** на product routes — потребителят го вижда на всяка страница след login. Старият visual прави cheap impression. Modern feedback widgets (Intercom, Hotjar, Linear) са clean, typographic, with тонко accent — никога не са heavy textured.

---

## Pre-decisions (locked)

- **Aesthetic system**: преминаваме на `legal-modern` (същия като legal-faq-modern-overhaul) — dark surface, hairline borders, accent color per page-context, modern form patterns.
- **FAB icon**: inline SVG envelope-with-quill (stroke-only, no fill). Matches achievement icons + FAQ category icons визуален език.
- **No new imagen assets** — heavy painterly art не подхожда на 56px floating button или 380px панел. Inline SVG + typography drives modernity.
- **New category selector** (4 options): Бъг / Идея / Похвала / Друго. Auto-routed в email subject за operator triage.
- **Visibility scope**: refinement на earlier prompt. FAB видим **само за authenticated users** на **product routes**. Skip за anonymous, marketing, info, auth-flow.
- **Page context auto-shown** — small line "Изпращаш от: /werewolf/create" в panel-а за прозрачност.
- **Success state celebration** — кратък confirmation с "Ще ти отговорим, ако си посочил имейл" + auto-close след 4 секунди.
- **Branch**: `feat/feedback-widget-overhaul`.

---

## Stage 1 — Visibility scope refinement

### Current state (от `codex-prompt-footer-and-fab-polish.md`)

```ts
const HIDDEN_ROUTES = [
  "/", "/werewolf", "/mafia",
  "/werewolf/rules", "/mafia/rules",
  "/werewolf/roles", "/mafia/roles", "/roles",
  "/sign-in", "/forgot-password", "/reset-password", "/verify-email",
  "/privacy", "/terms", "/faq", "/status",
];
```

### Add `/report` to HIDDEN_ROUTES

Когато потребителят е on `/report` и активно подава сигнал, floating FAB е redundant + confusing. Add:

```ts
const HIDDEN_ROUTES = [
  // ... existing
  "/report",  // user is already submitting structured report
];
```

### Add authenticated-only constraint

FAB видим **само за authenticated users**. Anonymous users (които minimum се случват, защото anonymous flow беше премахнат, но guards-те остават) — не виждат FAB.

Use `authClient.useSession()` (Better Auth React client hook) на mount:

```tsx
const { data: session, isPending } = authClient.useSession();

if (isPending || !session) return null;
if (shouldHideFeedback(pathname)) return null;
```

### Final visibility matrix

| Route | Was visible? | Now visible? |
|---|---|---|
| `/` | ❌ | ❌ |
| `/werewolf` `/mafia` (marketing) | ❌ | ❌ |
| `/werewolf/rules` `/mafia/rules` | ❌ | ❌ |
| `/werewolf/roles` `/mafia/roles` `/roles` | ❌ | ❌ |
| `/sign-in` `/forgot-password` etc | ❌ | ❌ |
| `/privacy` `/terms` `/faq` `/status` | ❌ | ❌ |
| `/report` | ✅ | ❌ NEW (was visible) |
| `/account` | ✅ | ✅ (но only if logged in) |
| `/play/[code]` | ✅ | ✅ |
| `/lobby/[code]` | ✅ | ✅ |
| `/werewolf/create` `/mafia/create` | ✅ | ✅ |
| `/werewolf/join/[code]` `/mafia/join/[code]` | ✅ | ✅ |
| `/history` `/leaderboard` `/achievements` `/friends` | ✅ | ✅ |
| `/tutorial` | ✅ | ✅ |
| Anonymous user on any route | ✅ (if route was visible) | ❌ NEW |

---

## Stage 2 — FAB icon redesign (inline SVG)

Replace the 💬 emoji rendering with a custom stroke-based SVG. Two options Codex may choose:

### Option A — Envelope with quill (recommended)

```tsx
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
      {/* Envelope body */}
      <path d="M5 10 L 5 24 Q 5 26 7 26 L 25 26 Q 27 26 27 24 L 27 10" />
      <path d="M5 10 L 16 18 L 27 10" />
      <path d="M5 10 Q 5 8 7 8 L 25 8 Q 27 8 27 10" />
      {/* Quill — diagonal feather */}
      <path d="M21 4 L 28 11" strokeWidth="1.8" />
      <path d="M19 5 L 21 4 L 22 6" />
      <path d="M28 11 L 26 13 L 24 11" />
    </svg>
  );
}
```

### Option B — Carrier pigeon (playful alternative)

```tsx
function FeedbackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* Pigeon body */}
      <path d="M10 20 Q 8 18 8 16 Q 8 12 14 12 Q 18 12 22 14 L 26 14 Q 28 14 28 16 Q 28 18 26 18 L 24 18" />
      {/* Wing */}
      <path d="M14 12 Q 12 9 14 7 Q 17 8 18 11" />
      {/* Tail */}
      <path d="M10 20 L 7 22 M10 20 L 8 24" />
      {/* Small note attached */}
      <rect x="20" y="22" width="6" height="5" rx="0.5" />
      <path d="M21 24 L 25 24 M21 25.5 L 24 25.5" />
    </svg>
  );
}
```

**Codex: choose Option A** (envelope is more universally readable for "feedback / leave a note"). Implement in `FeedbackWidget.tsx`. Use in `feedback-fab` and `feedback-panel-icon` (header decoration).

### FAB button styling

The FAB itself adopts subtle dark surface with accent border — **drops the brass orb**:

```tsx
<button
  type="button"
  className="feedback-fab"
  onClick={() => setOpen(true)}
  aria-label="Дай ни бележка"
>
  <FeedbackIcon className="feedback-fab-icon" />
</button>
```

---

## Stage 3 — Panel redesign (legal-modern aesthetic)

### Full rewrite of `FeedbackWidget.tsx`

```tsx
"use client";

import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type FeedbackCategory = "bug" | "idea" | "praise" | "other";
type Status = "idle" | "submitting" | "sent" | "error";

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

function shouldHideFeedback(pathname: string): boolean {
  return HIDDEN_ROUTES.some((route) => route === pathname);
}

function FeedbackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLTextAreaElement>(null);

  // Auth + visibility gate
  if (isPending) return null;
  if (!session) return null;
  if (shouldHideFeedback(pathname)) return null;

  // Auto-fill email if session has one (logged-in users likely want this)
  useEffect(() => {
    if (open && session?.user?.email && !email) {
      setEmail(session.user.email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus first field when panel opens
  useEffect(() => {
    if (open && firstFieldRef.current) {
      const timer = window.setTimeout(() => firstFieldRef.current?.focus(), 80);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  // Escape closes panel
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Auto-close 4s after success
  useEffect(() => {
    if (status !== "sent") return;
    const timer = window.setTimeout(() => {
      setOpen(false);
      setStatus("idle");
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [status]);

  function close() {
    setOpen(false);
    if (status !== "submitting") {
      setStatus("idle");
      setError("");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (body.trim().length < 10) {
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
          body: body.trim(),
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

  if (!open) {
    return (
      <button
        type="button"
        className="feedback-fab"
        onClick={() => setOpen(true)}
        aria-label="Дай ни бележка"
      >
        <FeedbackIcon className="feedback-fab-icon" />
      </button>
    );
  }

  return (
    <>
      <div className="feedback-overlay" aria-hidden onClick={close} />
      <aside
        className="feedback-panel"
        role="dialog"
        aria-labelledby="feedback-panel-title"
        ref={panelRef}
      >
        <header className="feedback-panel-head">
          <FeedbackIcon className="feedback-panel-icon" />
          <div>
            <p className="feedback-kicker">бележка от масата</p>
            <h2 id="feedback-panel-title">Дай ни бележка.</h2>
          </div>
          <button
            type="button"
            className="feedback-close"
            onClick={close}
            aria-label="Затвори"
          >
            ×
          </button>
        </header>

        {status === "sent" ? (
          <div className="feedback-sent" role="status">
            <div className="feedback-sent-mark" aria-hidden>✓</div>
            <p className="feedback-sent-title">Получено. Благодарим.</p>
            <p className="feedback-sent-detail">
              {email.trim() ? "Ще ти отговорим на " + email.trim() + ", ако се наложи." : "Прегледахме сигналите тази седмица. Ако посочиш имейл следващия път, ще можем да ти отговорим."}
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
                onChange={(e) => setBody(e.target.value)}
                placeholder={category === "bug" ? "Какво се счупи? Кога? Как се повтаря?" : category === "idea" ? "Какво предлагаш и защо помага?" : category === "praise" ? "Какво харесваш?" : "Кажи ни накратко."}
                rows={5}
                required
                minLength={10}
                maxLength={2000}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorBodyId : undefined}
              />
              <div className="feedback-field-foot">
                <span className="feedback-field-count">{body.length} / 2000</span>
                {error ? <span id={errorBodyId} className="feedback-field-error" role="alert">{error}</span> : null}
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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                autoComplete="email"
              />
            </div>

            <p className="feedback-context">
              <span className="feedback-context-label">Изпращаш от</span>
              <code>{pathname}</code>
            </p>

            <div className="feedback-actions">
              <button
                type="submit"
                className="feedback-submit"
                disabled={status === "submitting"}
              >
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
```

---

## Stage 4 — CSS overhaul (legal-modern aesthetic)

**Premахни напълно** старите rules в globals.css (lines ~11982-12100):
- `.feedback-fab`
- `.feedback-panel`
- `.feedback-close`
- `.feedback-kicker`
- `.feedback-panel h3`
- `.feedback-panel textarea`, `.feedback-panel input`
- `.feedback-error`
- `.feedback-sent`

**Замени с новата стилистика** (използва same CSS variables като `legal-modern` системата):

```css
/* ============================== */
/* Feedback Widget (modern)       */
/* ============================== */

:root {
  --feedback-bg: rgba(13, 10, 8, 0.92);
  --feedback-surface: rgba(26, 20, 16, 0.88);
  --feedback-surface-strong: rgba(36, 28, 22, 0.95);
  --feedback-text: #f5e8c8;
  --feedback-text-muted: rgba(245, 232, 200, 0.72);
  --feedback-text-soft: rgba(245, 232, 200, 0.5);
  --feedback-border: rgba(245, 232, 200, 0.12);
  --feedback-border-strong: rgba(245, 232, 200, 0.22);
  --feedback-accent: #d19a42;
  --feedback-accent-soft: rgba(209, 154, 66, 0.2);
}

/* FAB — floating action button */

.feedback-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 1px solid var(--feedback-border-strong);
  background: var(--feedback-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--feedback-accent);
  cursor: pointer;
  z-index: 50;
  display: grid;
  place-items: center;
  transition: transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1),
              border-color 160ms ease,
              box-shadow 200ms ease;
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.55),
    0 2px 4px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(245, 232, 200, 0.08);
}

.feedback-fab:hover {
  transform: translateY(-2px) scale(1.03);
  border-color: var(--feedback-accent);
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.6),
    0 4px 8px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(245, 232, 200, 0.12);
}

.feedback-fab:focus-visible {
  outline: none;
  border-color: var(--feedback-accent);
  box-shadow:
    0 0 0 3px var(--feedback-accent-soft),
    0 12px 32px rgba(0, 0, 0, 0.55);
}

.feedback-fab:active {
  transform: translateY(0) scale(0.97);
}

.feedback-fab-icon {
  width: 24px;
  height: 24px;
}

@media (max-width: 768px) {
  .feedback-fab {
    bottom: 88px;     /* avoid mobile browser chrome */
    right: 16px;
    width: 52px;
    height: 52px;
  }
}

/* Panel overlay (subtle, mobile-friendly) */

.feedback-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  z-index: 60;
  animation: feedback-fade-in 180ms ease-out;
}

@keyframes feedback-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Panel */

.feedback-panel {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 420px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  z-index: 70;
  background: var(--feedback-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--feedback-border-strong);
  border-radius: 16px;
  box-shadow:
    0 32px 64px rgba(0, 0, 0, 0.65),
    0 8px 16px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(245, 232, 200, 0.08);
  color: var(--feedback-text);
  font-family: "Noto Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  animation: feedback-slide-up 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes feedback-slide-up {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@media (max-width: 768px) {
  .feedback-panel {
    bottom: 16px;
    right: 16px;
    left: 16px;
    width: auto;
    max-width: none;
    max-height: calc(100vh - 32px);
  }
}

/* Panel header */

.feedback-panel-head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--feedback-border);
}

.feedback-panel-icon {
  width: 32px;
  height: 32px;
  color: var(--feedback-accent);
  flex-shrink: 0;
}

.feedback-panel-head > div {
  min-width: 0;
}

.feedback-kicker {
  font-size: 0.7rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--feedback-accent);
  margin: 0 0 2px;
}

.feedback-panel h2 {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--feedback-text);
  margin: 0;
  line-height: 1.2;
}

.feedback-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--feedback-border);
  background: transparent;
  color: var(--feedback-text-soft);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease;
}

.feedback-close:hover {
  border-color: var(--feedback-border-strong);
  color: var(--feedback-text);
}

/* Form */

.feedback-form {
  padding: 18px 20px 20px;
  display: grid;
  gap: 18px;
}

/* Category selector */

.feedback-category {
  border: none;
  padding: 0;
  margin: 0;
}

.feedback-category legend {
  font-size: 0.78rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--feedback-text-muted);
  margin-bottom: 10px;
}

.feedback-category-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.feedback-category-option {
  position: relative;
  display: block;
  padding: 10px 12px;
  background: var(--feedback-surface);
  border: 1px solid var(--feedback-border);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease;
}

.feedback-category-option:hover {
  border-color: var(--feedback-border-strong);
}

.feedback-category-option[data-active="true"] {
  border-color: var(--feedback-accent);
  background: var(--feedback-accent-soft);
}

.feedback-category-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.feedback-category-label {
  display: block;
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--feedback-text);
  margin-bottom: 2px;
}

.feedback-category-hint {
  display: block;
  font-size: 0.75rem;
  color: var(--feedback-text-soft);
  line-height: 1.35;
}

/* Form fields */

.feedback-field {
  display: grid;
  gap: 6px;
}

.feedback-field label {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--feedback-text);
}

.feedback-field-optional {
  color: var(--feedback-text-soft);
  font-weight: 500;
  font-size: 0.72rem;
}

.feedback-field textarea,
.feedback-field input {
  padding: 10px 12px;
  border: 1px solid var(--feedback-border-strong);
  border-radius: 10px;
  background: rgba(13, 10, 8, 0.5);
  color: var(--feedback-text);
  font-family: inherit;
  font-size: 0.95rem;
  line-height: 1.5;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.feedback-field textarea {
  resize: vertical;
  min-height: 100px;
  max-height: 200px;
}

.feedback-field textarea:focus,
.feedback-field input:focus {
  outline: none;
  border-color: var(--feedback-accent);
  box-shadow: 0 0 0 3px var(--feedback-accent-soft);
}

.feedback-field textarea::placeholder,
.feedback-field input::placeholder {
  color: var(--feedback-text-soft);
}

.feedback-field-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  min-height: 1.2em;
}

.feedback-field-count {
  color: var(--feedback-text-soft);
  font-variant-numeric: tabular-nums;
}

.feedback-field-error {
  color: #e57373;
  font-weight: 600;
}

/* Context line */

.feedback-context {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 0.75rem;
  color: var(--feedback-text-soft);
  background: rgba(245, 232, 200, 0.04);
  border: 1px dashed var(--feedback-border);
  border-radius: 8px;
}

.feedback-context-label {
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
}

.feedback-context code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  color: var(--feedback-text);
  background: rgba(245, 232, 200, 0.06);
  padding: 2px 6px;
  border-radius: 4px;
}

/* Actions */

.feedback-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.feedback-submit {
  flex: 1;
  padding: 10px 16px;
  background: var(--feedback-accent);
  border: 1px solid var(--feedback-accent);
  border-radius: 10px;
  color: #1a1410;
  font-family: inherit;
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: transform 160ms ease, filter 160ms ease;
}

.feedback-submit:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.feedback-submit:active:not(:disabled) {
  transform: translateY(0);
}

.feedback-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.feedback-cancel {
  padding: 10px 14px;
  background: transparent;
  border: 1px solid var(--feedback-border-strong);
  border-radius: 10px;
  color: var(--feedback-text-muted);
  font-family: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease;
}

.feedback-cancel:hover {
  border-color: var(--feedback-accent);
  color: var(--feedback-text);
}

/* Sent state */

.feedback-sent {
  padding: 32px 24px;
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 10px;
}

.feedback-sent-mark {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--feedback-accent-soft);
  border: 2px solid var(--feedback-accent);
  display: grid;
  place-items: center;
  font-size: 1.5rem;
  color: var(--feedback-accent);
  font-weight: 900;
  margin-bottom: 4px;
  animation: feedback-check 320ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes feedback-check {
  from { transform: scale(0.6); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.feedback-sent-title {
  font-family: "Noto Serif Display", serif;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--feedback-text);
  margin: 0;
}

.feedback-sent-detail {
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--feedback-text-muted);
  margin: 0;
  max-width: 32ch;
}

.feedback-sent-hint {
  margin-top: 8px;
  font-size: 0.75rem;
  color: var(--feedback-text-soft);
  font-style: italic;
}
```

---

## Stage 5 — Update `/api/feedback` to accept category

**File:** `apps/web/app/api/feedback/route.ts`

Add category to request parsing and to email payload:

```ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { renderFeedbackEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { auth } from "@/lib/auth";

const VALID_CATEGORIES = new Set(["bug", "idea", "praise", "other"]);

const CATEGORY_LABEL_BG: Record<string, string> = {
  bug: "Бъг",
  idea: "Идея",
  praise: "Похвала",
  other: "Друго",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;
  const page = typeof body.page === "string" ? body.page : "?";
  const categoryRaw = typeof body.category === "string" ? body.category : "other";
  const category = VALID_CATEGORIES.has(categoryRaw) ? categoryRaw : "other";

  if (text.length < 10) {
    return NextResponse.json({ error: "Кажи поне 10 символа." }, { status: 400 });
  }

  let actor = "анонимен";
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.email) actor = `${session.user.name ?? "?"} <${session.user.email}>`;
  } catch {
    // Feedback should still be accepted without session context.
  }

  const operatorEmail = process.env.REPORTS_NOTIFY_EMAIL;
  if (!operatorEmail) {
    console.log("[feedback]", { category, text, email, page, actor });
    return NextResponse.json({ ok: true });
  }

  try {
    const categoryLabel = CATEGORY_LABEL_BG[category];
    const summaryBody = `[${categoryLabel}]\n${actor}\n\n${text}`;
    const template = renderFeedbackEmail({
      brandUrl: process.env.BETTER_AUTH_URL ?? "",
      body: summaryBody,
      reporterEmail: email,
      page: `${page} · ${categoryLabel}`,
    });
    await sendEmail({ to: operatorEmail, ...template });
  } catch (error) {
    console.error("[feedback] email failed", error);
    return NextResponse.json({ error: "Бележката не успя да се изпрати." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

Operator sees email subject like `Бележка от /werewolf/create · Бъг` instead of generic feedback subject.

---

## Stage 6 — Update email template (optional polish)

**File:** `apps/web/lib/email-templates.ts`

The `renderFeedbackEmail` function вече приема `page` параметър. Since we're now formatting page as `path · category`, no shape change is needed. But Codex може да добави visual marker:

If the page string contains ` · `, split into path + category badge:

```ts
// In renderFeedbackEmail
const [pagePath, pageCategory] = params.page.includes(" · ")
  ? params.page.split(" · ")
  : [params.page, null];

// In HTML body
<p style="...">
  <span style="...">Страница:</span>
  <code style="...">${pagePath}</code>
  ${pageCategory ? `<span style="margin-left: 8px; padding: 2px 8px; background: #842f2b; color: #fff5e0; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">${pageCategory}</span>` : ""}
</p>
```

This is optional polish; Codex may skip if template ergonomics make it awkward.

---

## Stage 7 — Visual regression baselines

The widget appears на product routes. After implementation, regenerate baselines for routes that show it:

```bash
pnpm visual:update
```

Affected routes: `/account`, `/tutorial`, `/history`, `/leaderboard`, `/achievements`, `/friends`. Also generate captures with **panel open** (to verify panel design):

Add Playwright test helper that:
1. Visits `/tutorial` (auth required — seed session)
2. Clicks `.feedback-fab`
3. Waits for `.feedback-panel`
4. Captures screenshot as `tutorial-feedback-open-{viewport}.png`

Commit new baselines.

---

## Acceptance criteria

1. **FAB icon**: inline SVG envelope-with-quill, не emoji. Stroke-only, accent color.
2. **FAB visibility**: hidden on 17 routes (16 from earlier + `/report`). Hidden for unauthenticated users always.
3. **Panel design**: legal-modern aesthetic — dark surface, hairline accent border, no brass texture.
4. **Slide-up animation** at panel open (220ms cubic bezier).
5. **Category selector** (4 segmented radio cards): Бъг / Идея / Похвала / Друго, each with hint text.
6. **Form features**:
   - Character counter (X / 2000)
   - Inline error with `aria-invalid` + `aria-describedby`
   - Auto-fill email from session
   - Auto-focus first field at open
   - Escape key closes panel
   - Page context line at bottom shows current pathname
7. **Success state**:
   - Animated checkmark
   - Personalized message (mentions provided email)
   - Auto-close 4s
8. **API**: `/api/feedback` accepts `category`, validates against allow-list, includes in email subject and body.
9. **Email template** updated с category badge (optional polish).
10. **Visual baselines** regenerated for affected routes (closed FAB + open panel).
11. **No new imagen assets**.
12. **All commit messages in English**.
13. **All copy in Bulgarian**.
14. `pnpm verify` passes end to end.

---

## Не пипай

- `/report` page logic — that's a separate, more formal flow.
- Other product routes outside feedback widget scope.
- `useAuthSession` infrastructure — just consume `authClient.useSession()`.
- Old painterly art assets — no new imagen for this widget.
- Better Auth config.

---

## Verification

```bash
pnpm install
pnpm typecheck
pnpm regression
pnpm test
pnpm build
pnpm smoke
pnpm visual:update
pnpm visual
pnpm perf:budget
```

Manual checks:

1. **Anonymous user**:
   - Open any route → no FAB visible
   - Sign in → FAB appears on product routes only

2. **Authenticated user, marketing page**:
   - `/` `/werewolf` `/mafia` → no FAB
   - `/privacy` `/terms` `/faq` → no FAB
   - `/report` → no FAB
   - `/sign-in` (already signed in, redirected) → no FAB

3. **Authenticated user, product page**:
   - `/tutorial` → FAB visible bottom-right
   - Click FAB → panel slides up
   - Auto-focused textarea
   - Email pre-filled от session

4. **Form flow**:
   - Choose "Идея" → category-specific placeholder appears
   - Type 5 chars, submit → inline error "Кажи поне 10 символа."
   - Type 50 chars, submit → success state with checkmark
   - Wait 4 seconds → auto-close

5. **Keyboard**:
   - Press Escape → panel closes
   - Tab through fields → all reachable

6. **Mobile** (< 768px):
   - FAB положение: bottom-right с offset за browser chrome
   - Panel: full-width (16px margins), full-height
   - Touch targets все ≥ 44px

7. **Email**:
   - Submit feedback → operator email arrives
   - Subject: `Бележка от /tutorial · Идея`
   - Body shows category badge

---

## Commit strategy (10 atomic English commits)

Branch: `feat/feedback-widget-overhaul`

1. `feat(feedback): inline SVG envelope icon to replace emoji FAB`
2. `feat(feedback): require authenticated session for widget visibility`
3. `feat(feedback): hide on /report route to avoid duplicate flow`
4. `feat(feedback): legal-modern panel design with slide animation`
5. `feat(feedback): category selector with segmented radio cards`
6. `feat(feedback): character counter inline validation auto-fill email`
7. `feat(feedback): page context line and animated success state`
8. `feat(api): accept and route feedback category in email subject`
9. `style(email): feedback template renders category badge`
10. `chore(visual): regenerate baselines for feedback FAB and open panel`

PR title: `feat: modernize feedback widget with legal-modern aesthetic and category triage`

PR body should:
- Note that this builds on (and aligns with) `codex-prompt-legal-faq-modern-overhaul.md` design system.
- Mention removal of 💬 emoji icon — operator brand consistency improvement.
- Reviewer hint: test on `/tutorial` since it's the most-visited authenticated route.

---

(End of prompt)
