"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Bug, Check, Circle, CircleCheck, Copyright,
  LoaderCircle, Mail, RotateCcw, Send, ShieldAlert, ShieldCheck, type LucideIcon,
} from "lucide-react";

type ReportType = "abuse" | "copyright" | "bug" | "gdpr" | "other";
type Step = "type" | "details" | "identity" | "review" | "success";
type InvalidField = "body" | "evidence" | "email";

interface ReportWizardProps {
  userEmail: string | null;
  userName: string | null;
  visualStep: "review" | "success" | null;
}

interface TypeMeta {
  id: ReportType;
  label: string;
  hint: string;
  icon: LucideIcon;
  evidenceLabel: string;
  evidencePlaceholder: string;
  bodyPlaceholder: string;
}

const TYPE_META: Record<ReportType, TypeMeta> = {
  abuse: {
    id: "abuse",
    label: "Тормоз или неуместно поведение",
    hint: "Обиди, заплахи или нарушаване на правилата.",
    icon: ShieldAlert,
    evidenceLabel: "Код на стая и приблизителен час",
    evidencePlaceholder: "ABC123 · вчера около 21:30",
    bodyPlaceholder: "Какво се случи? Кой беше намесен? Кога? Какви бяха думите или действията?",
  },
  copyright: {
    id: "copyright",
    label: "Авторски права",
    hint: "Съдържание, което нарушава нечии авторски права.",
    icon: Copyright,
    evidenceLabel: "Линк към материала и кой е автор",
    evidencePlaceholder: "URL към съдържанието и кой е носител на правата",
    bodyPlaceholder:
      "Кое съдържание е използвано без разрешение и кой държи правата?",
  },
  bug: {
    id: "bug",
    label: "Технически проблем",
    hint: "Нещо в играта не работи или се държи неочаквано.",
    icon: Bug,
    evidenceLabel: "Страница, браузър и стъпки",
    evidencePlaceholder: "/play/ABC123 · Chrome · 1. Влязох в стая, 2. ...",
    bodyPlaceholder: "Какво се случи? Какво очакваше да се случи? Можеш ли да го повториш?",
  },
  gdpr: {
    id: "gdpr",
    label: "Лични данни",
    hint: "Въпрос или жалба, свързана с обработката на твоите лични данни.",
    icon: ShieldCheck,
    evidenceLabel: "Кое право упражняваш",
    evidencePlaceholder: "Достъп, изтриване, преносимост, възражение, ограничаване",
    bodyPlaceholder: "Какъв е въпросът ти или какво искаш да направим с твоите данни?",
  },
  other: {
    id: "other",
    label: "Друго",
    hint: "Друг въпрос или проблем.",
    icon: Mail,
    evidenceLabel: "Допълнителна информация",
    evidencePlaceholder: "Линк, име на стая или каквото може да помогне.",
    bodyPlaceholder: "Кажи ни накратко.",
  },
};

const STEPS: Step[] = ["type", "details", "identity", "review"];
const STEP_LABELS: Record<string, string> = {
  type: "Вид сигнал",
  details: "Подробности",
  identity: "Връзка",
  review: "Преглед",
};
const SEND_ERROR = "Сигналът не успя да се изпрати. Опитай отново.";
const UNCONFIRMED_ERROR = "Не успяхме да потвърдим изпращането. Провери връзката си и опитай отново.";
const REQUEST_TIMEOUT_MS = 15_000;

export function ReportWizard({ userEmail, userName, visualStep }: ReportWizardProps) {
  const isVisualReview = visualStep === "review" || visualStep === "success";
  const [step, setStep] = useState<Step>(visualStep ?? "type");
  const [type, setType] = useState<ReportType>("abuse");
  const [body, setBody] = useState(
    isVisualReview ? "Играч използва обиди в стаята и продължи след предупреждение." : "",
  );
  const [evidence, setEvidence] = useState(isVisualReview ? "ABC123 · вчера около 21:30" : "");
  const [identity, setIdentity] = useState<"private" | "identified">(
    userEmail ? "identified" : "private",
  );
  const [email, setEmail] = useState(userEmail ?? "");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [invalidField, setInvalidField] = useState<InvalidField | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(
    visualStep === "success" ? "СИГ-0123456789" : null,
  );

  const bodyId = useId();
  const evidenceId = useId();
  const emailId = useId();
  const fieldErrorId = useId();
  const typeHintId = useId();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const evidenceRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const legendRef = useRef<HTMLLegendElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);
  const attemptRef = useRef<{ startedAt: number; nonce: string } | null>(null);
  const cancelRequestRef = useRef<(() => void) | null>(null);
  const interruptedRef = useRef(false);
  const previousStepRef = useRef(step);

  useEffect(() => {
    // Activity can disconnect effects while retaining this draft and its UI state.
    if (interruptedRef.current) {
      interruptedRef.current = false;
      setErrorMsg(UNCONFIRMED_ERROR);
      setStatus("error");
    }
    return () => {
      const cancel = cancelRequestRef.current;
      cancelRequestRef.current = null;
      cancel?.();
    };
  }, []);

  useEffect(() => {
    if (previousStepRef.current !== step) {
      legendRef.current?.focus();
      previousStepRef.current = step;
    }
  }, [step]);

  useEffect(() => {
    if (status === "error") errorRef.current?.focus();
  }, [status]);

  const meta = TYPE_META[type];
  const stepIndex = STEPS.indexOf(step);
  const totalSteps = STEPS.length;
  function goNext() {
    const next = STEPS[stepIndex + 1];
    if (next) {
      setStep(next);
    }
  }

  function goBack() {
    if (submittingRef.current) return;
    const prev = STEPS[stepIndex - 1];
    if (prev) {
      setInvalidField(null);
      setErrorMsg("");
      setStatus("idle");
      setStep(prev);
    }
  }

  function validateStep(): { field: InvalidField; message: string } | null {
    if (step === "details" && body.trim().length < 20) {
      return { field: "body", message: "Опиши с поне 20 символа." };
    }
    if (step === "details" && body.trim().length > 4000) {
      return { field: "body", message: "Описанието може да е до 4000 символа." };
    }
    if (step === "details" && evidence.trim().length > 500) {
      return { field: "evidence", message: "Допълнителната информация може да е до 500 символа." };
    }

    if (step === "identity") {
      const trimmedEmail = email.trim();
      if (identity === "identified" && !trimmedEmail) {
        return { field: "email", message: "Въведи имейл или избери анонимен сигнал." };
      }
      if (identity === "identified" && trimmedEmail.length > 254) {
        return { field: "email", message: "Имейлът може да е до 254 символа." };
      }
      if (identity === "identified" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
        return { field: "email", message: "Въведи валиден имейл." };
      }
    }

    return null;
  }

  function advance() {
    if (submittingRef.current) return;
    const validation = validateStep();
    if (validation) {
      setInvalidField(validation.field);
      setErrorMsg(validation.message);
      const fields = { body: bodyRef, evidence: evidenceRef, email: emailRef };
      fields[validation.field].current?.focus();
      return;
    }
    setInvalidField(null);
    setErrorMsg("");
    setStatus("idle");
    goNext();
  }

  function clearFieldError(field: InvalidField) {
    if (invalidField !== field) {
      return;
    }
    setInvalidField(null);
    setErrorMsg("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (step !== "review") {
      advance();
      return;
    }
    // A form submit alone is not consent: only the final review button can send.
    if ((event.nativeEvent as SubmitEvent).submitter !== submitRef.current) return;
    submittingRef.current = true;
    setStatus("submitting");
    setInvalidField(null);
    setErrorMsg("");

    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    try {
      const requestBody = JSON.stringify({
        type,
        body: body.trim(),
        email: identity === "identified" && email.trim() ? email.trim() : null,
        evidence: evidence.trim() || null,
      });
      attemptRef.current ??= { startedAt: Date.now(), nonce: crypto.randomUUID() };
      const attempt = attemptRef.current;
      // Race the entire response, including JSON, even if a transport ignores abort.
      const deadline = new Promise<never>((_resolve, reject) => {
        const cancel = () => {
          reject(new Error("Report request interrupted"));
          controller.abort();
        };
        timeout = setTimeout(cancel, REQUEST_TIMEOUT_MS);
        cancelRequestRef.current = () => {
          disposed = true;
          interruptedRef.current = true;
          submittingRef.current = false;
          clearTimeout(timeout);
          cancel();
        };
      });
      const { response, payload } = await Promise.race([
        (async () => {
          // A private nonce binds keys to this draft without retaining a history of
          // report text. Editing back to an earlier payload reuses its original key.
          const digest = await crypto.subtle.digest(
            "SHA-256", new TextEncoder().encode(JSON.stringify([attempt.nonce, requestBody])),
          );
          const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
          const key = `${attempt.startedAt}.${hash}`;
          if (controller.signal.aborted) throw new Error("Report request interrupted");
          const response = await fetch("/api/report", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Idempotency-Key": key },
            body: requestBody,
            signal: controller.signal,
          });
          if (controller.signal.aborted) throw new Error("Report request interrupted");
          const payload: unknown = await response.json().catch(() => null);
          return { response, payload };
        })(),
        deadline,
      ]);
      if (disposed) return;

      const data = payload && typeof payload === "object"
        ? payload as { error?: unknown; referenceId?: unknown }
        : null;

      if (!response.ok) {
        setErrorMsg(typeof data?.error === "string" && data.error.trim() ? data.error : SEND_ERROR);
        setStatus("error");
        return;
      }

      if (typeof data?.referenceId !== "string" || !/^СИГ-[A-F0-9]{10}$/.test(data.referenceId)) {
        setErrorMsg("Не успяхме да потвърдим изпращането. Опитай отново след малко.");
        setStatus("error");
        return;
      }

      setReferenceId(data.referenceId);
      setStep("success");
      setStatus("idle");
    } catch {
      if (disposed) return;
      setErrorMsg(UNCONFIRMED_ERROR);
      setStatus("error");
    } finally {
      clearTimeout(timeout);
      if (!disposed) {
        cancelRequestRef.current = null;
        submittingRef.current = false;
      }
    }
  }

  if (step === "success") {
    return <ReportSuccessState referenceId={referenceId} identity={identity} type={type} />;
  }

  return (
    <section className="report-wizard" aria-label="Подаване на сигнал">
      <nav className="report-wizard-progress" aria-label="Стъпки">
        <div className="report-wizard-progress-bar" aria-hidden>
          <div
            className="report-wizard-progress-fill"
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>
        <p className="report-wizard-progress-label" role="status" aria-live="polite" aria-atomic="true">
          {status === "submitting" ? "Изпращаме сигнала..." : `Стъпка ${stepIndex + 1} от ${totalSteps}: ${STEP_LABELS[step]}`}
        </p>
        <ol className="report-wizard-steps">
          {STEPS.map((item, index) => (
            <li
              key={item}
              className="report-wizard-progress-step"
              aria-current={item === step ? "step" : undefined}
              data-complete={index < stepIndex}
            >
              <span className="report-step-marker" aria-hidden="true">
                {index < stepIndex ? <Check size={16} /> : index + 1}
              </span>{" "}
              <span className="report-step-name">{STEP_LABELS[item]}</span>
            </li>
          ))}
        </ol>
      </nav>

      <form onSubmit={submit} noValidate aria-busy={status === "submitting"}>
        {step === "type" ? (
          <fieldset className="report-wizard-step">
            <legend ref={legendRef} tabIndex={-1}>За какво е сигналът?</legend>
            <div className="report-type-grid">
              {(Object.keys(TYPE_META) as ReportType[]).map((key) => {
                const item = TYPE_META[key];
                const Icon = type === key ? CircleCheck : item.icon;
                return (
                  <label key={key} className="report-type-card" data-active={type === key}>
                    <input
                      type="radio"
                      name="report-type"
                      value={key}
                      checked={type === key}
                      aria-describedby={type === key ? typeHintId : undefined}
                      onChange={() => setType(key)}
                    />
                    <span className="report-type-icon" aria-hidden>
                      <Icon size={20} />
                    </span>
                    <span className="report-type-label">{item.label}</span>
                    <span className="report-type-hint">{item.hint}</span>
                  </label>
                );
              })}
            </div>
            <p id={typeHintId} className="report-selected-hint">{meta.hint}</p>
          </fieldset>
        ) : null}

        {step === "details" ? (
          <fieldset className="report-wizard-step">
            <legend ref={legendRef} tabIndex={-1}>Какво се случи?</legend>
            <p className="report-wizard-step-lede">
              Не включвай пароли или друга чувствителна информация.
            </p>

            <div className="report-field">
              <label htmlFor={bodyId}>Описание</label>
              <textarea
                id={bodyId}
                ref={bodyRef}
                value={body}
                onChange={(event) => {
                  setBody(event.target.value);
                  clearFieldError("body");
                }}
                placeholder={meta.bodyPlaceholder}
                rows={6}
                minLength={20}
                maxLength={4000}
                required
                aria-invalid={invalidField === "body"}
                aria-describedby={invalidField === "body" ? fieldErrorId : undefined}
              />
              {invalidField === "body" ? <p id={fieldErrorId} className="report-wizard-error" role="alert">{errorMsg}</p> : null}
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
                ref={evidenceRef}
                type="text"
                value={evidence}
                onChange={(event) => {
                  setEvidence(event.target.value);
                  clearFieldError("evidence");
                }}
                placeholder={meta.evidencePlaceholder}
                maxLength={500}
                aria-invalid={invalidField === "evidence"}
                aria-describedby={invalidField === "evidence" ? fieldErrorId : undefined}
              />
              {invalidField === "evidence" ? <p id={fieldErrorId} className="report-wizard-error" role="alert">{errorMsg}</p> : null}
            </div>
          </fieldset>
        ) : null}

        {step === "identity" ? (
          <fieldset className="report-wizard-step">
            <legend ref={legendRef} tabIndex={-1}>Как искаш да отговорим?</legend>
            <p className="report-wizard-step-lede">
              Имейлът е по избор. Без него няма как да се свържем с теб.
            </p>

            <div className="report-identity-grid">
              <label className="report-identity-card" data-active={identity === "identified"}>
                <input
                  type="radio"
                  name="report-identity"
                  value="identified"
                  checked={identity === "identified"}
                  onChange={() => {
                    setIdentity("identified");
                    clearFieldError("email");
                  }}
                />
                <span className="report-identity-title">
                  {identity === "identified" ? <CircleCheck size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />} С имейл
                </span>
                <span className="report-identity-hint">
                  За връзка по този сигнал.
                </span>
              </label>

              <label className="report-identity-card" data-active={identity === "private"}>
                <input
                  type="radio"
                  name="report-identity"
                  value="private"
                  checked={identity === "private"}
                  onChange={() => {
                    setIdentity("private");
                    clearFieldError("email");
                  }}
                />
                <span className="report-identity-title">
                  {identity === "private" ? <CircleCheck size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />} Анонимно
                </span>
                <span className="report-identity-hint">
                  Без имейл или име от досието ти.
                </span>
              </label>
            </div>

            {identity === "identified" ? (
              <div className="report-field">
                <label htmlFor={emailId}>Твоят имейл</label>
                <input
                  id={emailId}
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearFieldError("email");
                  }}
                  placeholder="ime@example.bg"
                  autoComplete="email"
                  maxLength={254}
                  required
                  aria-invalid={invalidField === "email"}
                  aria-describedby={invalidField === "email" ? fieldErrorId : undefined}
                />
                {invalidField === "email" ? <p id={fieldErrorId} className="report-wizard-error" role="alert">{errorMsg}</p> : null}
                {userEmail && email === userEmail ? (
                  <p className="report-field-hint">
                    {userName ? `Имейл от досието на ${userName}.` : "Имейл от твоето досие."}
                  </p>
                ) : null}
              </div>
            ) : null}
          </fieldset>
        ) : null}

        {step === "review" ? (
          <fieldset className="report-wizard-step">
            <legend ref={legendRef} tabIndex={-1}>Преглед преди изпращане.</legend>

            <dl className="report-review">
              <div>
                <dt>Вид сигнал</dt>
                <dd>{meta.label}</dd>
              </div>
              <div>
                <dt>Описание</dt>
                <dd className="report-review-body">{body.trim()}</dd>
              </div>
              {evidence.trim() ? (
                <div>
                  <dt>Допълнителна информация</dt>
                  <dd>{evidence.trim()}</dd>
                </div>
              ) : null}
              <div>
                <dt>Връзка</dt>
                <dd>{identity === "identified" ? `С имейл (${email.trim()})` : "Анонимно"}</dd>
              </div>
            </dl>

            <p className="report-review-promise">
              Сигналът се изпраща до екипа и не се публикува.
            </p>
          </fieldset>
        ) : null}

        {errorMsg && !invalidField ? (
          <p id={fieldErrorId} ref={errorRef} tabIndex={-1} className="report-wizard-error" role="alert">
            {errorMsg}
          </p>
        ) : null}

        <div className="report-wizard-actions">
          {stepIndex > 0 ? (
            <button type="button" className="report-wizard-back" onClick={goBack} disabled={status === "submitting"}>
              <ArrowLeft size={18} aria-hidden="true" /> Назад
            </button>
          ) : (
            <Link href="/" className="report-wizard-back">
              Затвори
            </Link>
          )}

          {step === "review" ? (
            <button
              key="confirm-report"
              ref={submitRef}
              type="submit"
              className="report-wizard-submit"
              disabled={status === "submitting"}
            >
              {status === "submitting" ? <LoaderCircle size={18} aria-hidden="true" /> : status === "error" ? <RotateCcw size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
              {status === "submitting" ? "Изпращаме..." : status === "error" ? "Опитай отново" : "Изпрати сигнал"}
            </button>
          ) : (
            <button key="advance-report" type="button" className="report-wizard-next" onClick={advance}>
              Напред <ArrowRight size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function ReportSuccessState({
  referenceId,
  identity,
  type,
}: {
  referenceId: string | null;
  identity: "private" | "identified";
  type: ReportType;
}) {
  const meta = TYPE_META[type];
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="report-success" role="status">
      <div className="report-success-beam" aria-hidden />

      <div className="report-success-icon" aria-hidden>
        <CircleCheck size={64} />
      </div>

      <p className="report-success-kicker">сигналът е получен</p>
      <h2 ref={headingRef} tabIndex={-1} className="report-success-title">Сигналът е изпратен.</h2>
      <p className="report-success-detail">
        Получихме сигнала ти за <strong>{meta.label.toLowerCase()}</strong>.
      </p>

      {referenceId ? (
        <div className="report-success-reference">
          <p className="report-success-ref-label">Номер на сигнала</p>
          <p className="report-success-ref-value">{referenceId}</p>
          <p className="report-success-ref-hint">
            Запази го за бъдеща връзка с екипа.
          </p>
        </div>
      ) : null}

      {identity === "identified" ? (
        <p className="report-success-followup">Можем да се свържем с теб на посочения имейл.</p>
      ) : (
        <p className="report-success-followup">
          Сигналът е анонимен. Не е посочен имейл за връзка.
        </p>
      )}

      <div className="report-success-actions">
        <Link href="/" className="report-success-link">
          Към началото
        </Link>
        <Link href="/account" className="report-success-link">
          Към досието
        </Link>
      </div>
    </section>
  );
}
