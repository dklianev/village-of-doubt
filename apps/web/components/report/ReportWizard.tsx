"use client";

import Link from "next/link";
import { type FormEvent, useId, useMemo, useState } from "react";

type ReportType = "abuse" | "copyright" | "bug" | "gdpr" | "other";
type Step = "type" | "details" | "identity" | "review" | "success";

interface ReportWizardProps {
  userEmail: string | null;
  userName: string | null;
}

interface TypeMeta {
  id: ReportType;
  label: string;
  hint: string;
  icon: string;
  evidenceLabel: string;
  evidencePlaceholder: string;
  bodyPlaceholder: string;
}

const TYPE_META: Record<ReportType, TypeMeta> = {
  abuse: {
    id: "abuse",
    label: "Тормоз или неуместно поведение",
    hint: "Друг играч ти причинява дискомфорт или нарушава кодекса на масата.",
    icon: "!",
    evidenceLabel: "Код на стая и приблизителен час",
    evidencePlaceholder: "ABC123 · вчера около 21:30",
    bodyPlaceholder: "Какво се случи? Кой беше намесен? Кога? Какви бяха думите или действията?",
  },
  copyright: {
    id: "copyright",
    label: "Авторски права",
    hint: "Съдържание, което нарушава нечии авторски права.",
    icon: "©",
    evidenceLabel: "Линк към материала и кой е автор",
    evidencePlaceholder: "URL към съдържанието и кой е носител на правата",
    bodyPlaceholder:
      "Какво съдържание е защитено? Кога е публикувано? С какво доказваш правата си?",
  },
  bug: {
    id: "bug",
    label: "Технически бъг",
    hint: "Нещо в играта не работи или се държи неочаквано.",
    icon: "⚙",
    evidenceLabel: "Страница, браузър и стъпки",
    evidencePlaceholder: "/play/ABC123 · Chrome · 1. Влязох в стая, 2. ...",
    bodyPlaceholder: "Какво се случи? Какво очакваше да се случи? Можеш ли да го повториш?",
  },
  gdpr: {
    id: "gdpr",
    label: "Лични данни / GDPR",
    hint: "Въпрос или жалба, свързана с обработката на твоите лични данни.",
    icon: "§",
    evidenceLabel: "Кое право упражняваш",
    evidencePlaceholder: "Достъп, изтриване, преносимост, възражение, ограничаване",
    bodyPlaceholder: "Какво искаш да направим с твоите данни? Защо?",
  },
  other: {
    id: "other",
    label: "Друго",
    hint: "Не пасва в горните категории, но искаш да ни кажеш.",
    icon: "✉",
    evidenceLabel: "Допълнителна информация (по избор)",
    evidencePlaceholder: "Линк, име на стая или каквото може да помогне.",
    bodyPlaceholder: "Кажи ни накратко.",
  },
};

const STEPS: Step[] = ["type", "details", "identity", "review"];

export function ReportWizard({ userEmail, userName }: ReportWizardProps) {
  const [step, setStep] = useState<Step>("type");
  const [type, setType] = useState<ReportType>("abuse");
  const [body, setBody] = useState("");
  const [evidence, setEvidence] = useState("");
  const [identity, setIdentity] = useState<"anonymous" | "identified">(
    userEmail ? "identified" : "anonymous",
  );
  const [email, setEmail] = useState(userEmail ?? "");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [referenceId, setReferenceId] = useState<string | null>(null);

  const bodyId = useId();
  const evidenceId = useId();
  const emailId = useId();
  const bodyErrorId = useId();

  const meta = TYPE_META[type];
  const stepIndex = STEPS.indexOf(step);
  const totalSteps = STEPS.length;
  const referenceSeed = useMemo(() => generateReferenceId(), []);

  function goNext() {
    const next = STEPS[stepIndex + 1];
    if (next) {
      setStep(next);
    }
  }

  function goBack() {
    const prev = STEPS[stepIndex - 1];
    if (prev) {
      setStep(prev);
    }
  }

  function validateStep(): string | null {
    if (step === "details" && body.trim().length < 20) {
      return "Опиши с поне 20 символа.";
    }

    if (step === "identity") {
      const trimmedEmail = email.trim();
      if (identity === "identified" && !trimmedEmail) {
        return "Въведи имейл или избери анонимен сигнал.";
      }
      if (identity === "identified" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
        return "Невалиден имейл.";
      }
    }

    return null;
  }

  function advance() {
    const error = validateStep();
    if (error) {
      setErrorMsg(error);
      return;
    }
    setErrorMsg("");
    goNext();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          body: body.trim(),
          email: identity === "identified" && email.trim() ? email.trim() : null,
          evidence: evidence.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(data.error ?? "Грешка при изпращане.");
        setStatus("error");
        return;
      }

      setReferenceId(referenceSeed);
      setStep("success");
      setStatus("idle");
    } catch {
      setErrorMsg("Грешка при изпращане.");
      setStatus("error");
    }
  }

  if (step === "success") {
    return <ReportSuccessState referenceId={referenceId} identity={identity} type={type} />;
  }

  return (
    <section className="report-wizard" aria-label="Сигнал — съветник">
      <nav className="report-wizard-progress" aria-label="Стъпки">
        <div className="report-wizard-progress-bar" aria-hidden>
          <div
            className="report-wizard-progress-fill"
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>
        <p className="report-wizard-progress-label">
          Стъпка {stepIndex + 1} от {totalSteps}
        </p>
      </nav>

      <form onSubmit={submit}>
        {step === "type" ? (
          <fieldset className="report-wizard-step">
            <legend>За какво е сигналът?</legend>
            <p className="report-wizard-step-lede">
              Избери вида, който най-точно описва ситуацията.
            </p>
            <div className="report-type-grid">
              {(Object.keys(TYPE_META) as ReportType[]).map((key) => {
                const item = TYPE_META[key];
                return (
                  <label key={key} className="report-type-card" data-active={type === key}>
                    <input
                      type="radio"
                      name="report-type"
                      value={key}
                      checked={type === key}
                      onChange={() => setType(key)}
                    />
                    <span className="report-type-icon" aria-hidden>
                      {item.icon}
                    </span>
                    <span className="report-type-label">{item.label}</span>
                    <span className="report-type-hint">{item.hint}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {step === "details" ? (
          <fieldset className="report-wizard-step">
            <legend>Какво се случи?</legend>
            <p className="report-wizard-step-lede">
              Колкото повече подробности, толкова по-бързо реагираме.
            </p>

            <div className="report-field">
              <label htmlFor={bodyId}>Описание</label>
              <textarea
                id={bodyId}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={meta.bodyPlaceholder}
                rows={6}
                minLength={20}
                maxLength={4000}
                required
                aria-invalid={Boolean(errorMsg)}
                aria-describedby={errorMsg ? bodyErrorId : undefined}
              />
              <div className="report-field-foot">
                <span className="report-field-count">{body.length} / 4000</span>
              </div>
            </div>

            <div className="report-field">
              <label htmlFor={evidenceId}>
                {meta.evidenceLabel} <span className="report-field-optional">(по избор)</span>
              </label>
              <input
                id={evidenceId}
                type="text"
                value={evidence}
                onChange={(event) => setEvidence(event.target.value)}
                placeholder={meta.evidencePlaceholder}
                maxLength={500}
              />
            </div>
          </fieldset>
        ) : null}

        {step === "identity" ? (
          <fieldset className="report-wizard-step">
            <legend>Как искаш да отговорим?</legend>
            <p className="report-wizard-step-lede">
              Можеш да подадеш сигнала анонимно — но няма да можем да ти отговорим лично.
            </p>

            <div className="report-identity-grid">
              <label className="report-identity-card" data-active={identity === "identified"}>
                <input
                  type="radio"
                  name="report-identity"
                  value="identified"
                  checked={identity === "identified"}
                  onChange={() => setIdentity("identified")}
                />
                <span className="report-identity-title">С имейл</span>
                <span className="report-identity-hint">
                  Получаваш отговор. Имейлът се ползва само за този сигнал.
                </span>
              </label>

              <label className="report-identity-card" data-active={identity === "anonymous"}>
                <input
                  type="radio"
                  name="report-identity"
                  value="anonymous"
                  checked={identity === "anonymous"}
                  onChange={() => setIdentity("anonymous")}
                />
                <span className="report-identity-title">Анонимно</span>
                <span className="report-identity-hint">
                  Не запазваме имейл. Действаме по сигнала, но не получаваш потвърждение.
                </span>
              </label>
            </div>

            {identity === "identified" ? (
              <div className="report-field">
                <label htmlFor={emailId}>Твоят имейл</label>
                <input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ime@example.bg"
                  autoComplete="email"
                  required
                />
                {userEmail ? (
                  <p className="report-field-hint">Предварително попълнен от твоя профил.</p>
                ) : null}
                {userName ? <p className="report-field-hint">Ще отговорим на {userName}.</p> : null}
              </div>
            ) : null}
          </fieldset>
        ) : null}

        {step === "review" ? (
          <fieldset className="report-wizard-step">
            <legend>Преглед преди изпращане.</legend>
            <p className="report-wizard-step-lede">Виж дали всичко изглежда наред.</p>

            <dl className="report-review">
              <div>
                <dt>Вид сигнал</dt>
                <dd>
                  {meta.icon} {meta.label}
                </dd>
              </div>
              <div>
                <dt>Описание</dt>
                <dd className="report-review-body">{body}</dd>
              </div>
              {evidence ? (
                <div>
                  <dt>Доказателство</dt>
                  <dd>{evidence}</dd>
                </div>
              ) : null}
              <div>
                <dt>Идентичност</dt>
                <dd>{identity === "identified" ? `С имейл (${email})` : "Анонимно"}</dd>
              </div>
            </dl>

            <p className="report-review-promise">
              Преглеждаме всеки сигнал в рамките на <strong>48 часа</strong>. При спешност можем да
              реагираме по-бързо.
            </p>
          </fieldset>
        ) : null}

        {errorMsg ? (
          <p id={bodyErrorId} className="report-wizard-error" role="alert">
            {errorMsg}
          </p>
        ) : null}

        <div className="report-wizard-actions">
          {stepIndex > 0 ? (
            <button type="button" className="report-wizard-back" onClick={goBack}>
              ← Назад
            </button>
          ) : (
            <Link href="/" className="report-wizard-back">
              ← Към началото
            </Link>
          )}

          {step === "review" ? (
            <button
              type="submit"
              className="report-wizard-submit"
              disabled={status === "submitting"}
            >
              {status === "submitting" ? "Изпращаме..." : "Изпрати сигнал"}
            </button>
          ) : (
            <button type="button" className="report-wizard-next" onClick={advance}>
              Напред →
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function generateReferenceId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let index = 0; index < 4; index += 1) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `СИГ-${id}`;
}

function ReportSuccessState({
  referenceId,
  identity,
  type,
}: {
  referenceId: string | null;
  identity: "anonymous" | "identified";
  type: ReportType;
}) {
  const meta = TYPE_META[type];

  return (
    <section className="report-success" role="status">
      <div className="report-success-beam" aria-hidden />

      <div className="report-success-icon" aria-hidden>
        <svg
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="32" cy="32" r="28" />
          <path d="M20 32 L 28 40 L 44 24" />
        </svg>
      </div>

      <p className="report-success-kicker">сигналът е получен</p>
      <h2 className="report-success-title">Светилникът свети.</h2>
      <p className="report-success-detail">
        Получихме сигнала ти за <strong>{meta.label.toLowerCase()}</strong>. Преглеждаме в рамките
        на <strong>48 часа</strong>.
      </p>

      {referenceId ? (
        <div className="report-success-reference">
          <p className="report-success-ref-label">Референция</p>
          <p className="report-success-ref-value">{referenceId}</p>
          <p className="report-success-ref-hint">
            Запази я, ако искаш да се позовеш на този сигнал по-късно.
          </p>
        </div>
      ) : null}

      {identity === "identified" ? (
        <p className="report-success-followup">Ще получиш отговор на посочения имейл.</p>
      ) : (
        <p className="report-success-followup">
          Сигналът е анонимен — няма да получиш потвърждение.
        </p>
      )}

      <div className="report-success-actions">
        <Link href="/" className="report-success-link">
          Към началото
        </Link>
        <Link href="/account" className="report-success-link">
          Към профила
        </Link>
      </div>
    </section>
  );
}
