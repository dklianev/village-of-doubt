"use client";

import { EmptyState, Pill } from "@werewolf/ui";
import { type FormEvent, useId, useMemo, useState } from "react";
import { ArtifactImage } from "@/components/ArtifactImage";
import styles from "./ReportWizard.module.css";

type ReportType = "abuse" | "copyright" | "bug" | "gdpr" | "other";
type Step = "type" | "details" | "identity" | "review" | "success";

interface ReportWizardProps {
  userEmail: string | null;
  userName: string | null;
  visualStep: "review" | "success" | null;
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
  const [referenceId, setReferenceId] = useState<string | null>(
    visualStep === "success" ? "СИГ-DDDD" : null,
  );

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
    <section className={styles.wizard} aria-label="Сигнал — съветник">
      <nav className={styles.progress} aria-label="Стъпки">
        <div className={styles.progressBar} aria-hidden>
          <div
            className={styles.progressFill}
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>
        <p className={styles.progressLabel}>
          Стъпка {stepIndex + 1} от {totalSteps}
        </p>
      </nav>

      <form onSubmit={submit}>
        {step === "type" ? (
          <fieldset className={styles.step}>
            <legend>За какво е сигналът?</legend>
            <p className={styles.stepLede}>
              Избери вида, който най-точно описва ситуацията.
            </p>
            <div className={styles.typeGrid}>
              {(Object.keys(TYPE_META) as ReportType[]).map((key) => {
                const item = TYPE_META[key];
                return (
                  <label key={key} className={styles.typeCard} data-active={type === key}>
                    <input
                      type="radio"
                      name="report-type"
                      value={key}
                      checked={type === key}
                      onChange={() => setType(key)}
                    />
                    <span className={styles.typeIcon} aria-hidden>
                      {item.icon}
                    </span>
                    <span className={styles.typeLabel}>{item.label}</span>
                    <span className={styles.typeHint}>{item.hint}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {step === "details" ? (
          <fieldset className={styles.step}>
            <legend>Какво се случи?</legend>
            <p className={styles.stepLede}>
              Колкото повече подробности, толкова по-бързо реагираме.
            </p>

            <div className={styles.field}>
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
              <div className={styles.fieldFoot}>
                <span className={styles.fieldCount}>{body.length} / 4000</span>
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor={evidenceId}>
                {meta.evidenceLabel} <span className={styles.fieldOptional}>(по избор)</span>
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
          <fieldset className={styles.step}>
            <legend>Как искаш да отговорим?</legend>
            <p className={styles.stepLede}>
              Можеш да подадеш сигнала анонимно — но няма да можем да ти отговорим лично.
            </p>

            <div className={styles.identityGrid}>
              <label className={styles.identityCard} data-active={identity === "identified"}>
                <input
                  type="radio"
                  name="report-identity"
                  value="identified"
                  checked={identity === "identified"}
                  onChange={() => setIdentity("identified")}
                />
                <span className={styles.identityTitle}>С имейл</span>
                <span className={styles.identityHint}>
                  Получаваш отговор. Имейлът се ползва само за този сигнал.
                </span>
              </label>

              <label className={styles.identityCard} data-active={identity === "private"}>
                <input
                  type="radio"
                  name="report-identity"
                  value="private"
                  checked={identity === "private"}
                  onChange={() => setIdentity("private")}
                />
                <span className={styles.identityTitle}>Анонимно</span>
                <span className={styles.identityHint}>
                  Не запазваме имейл. Действаме по сигнала, но не получаваш потвърждение.
                </span>
              </label>
            </div>

            {identity === "identified" ? (
              <div className={styles.field}>
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
                  <p className={styles.fieldHint}>Предварително попълнен от твоето досие.</p>
                ) : null}
                {userName ? <p className={styles.fieldHint}>Ще отговорим на {userName}.</p> : null}
              </div>
            ) : null}
          </fieldset>
        ) : null}

        {step === "review" ? (
          <fieldset className={styles.step}>
            <legend>Преглед преди изпращане.</legend>
            <p className={styles.stepLede}>Виж дали всичко изглежда наред.</p>

            <dl className={styles.review}>
              <div>
                <dt>Вид сигнал</dt>
                <dd>
                  {meta.icon} {meta.label}
                </dd>
              </div>
              <div>
                <dt>Описание</dt>
                <dd className={styles.reviewBody}>{body}</dd>
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

            <p className={styles.reviewPromise}>
              Преглеждаме всеки сигнал в рамките на <strong>48 часа</strong>. При спешност можем да
              реагираме по-бързо.
            </p>
          </fieldset>
        ) : null}

        {errorMsg ? (
          <p id={bodyErrorId} className={styles.error} role="alert">
            {errorMsg}
          </p>
        ) : null}

        <div className={styles.actions}>
          {stepIndex > 0 ? (
            <Pill type="button" intent="ghost" onClick={goBack}>
              ← Назад
            </Pill>
          ) : (
            <Pill as="a" href="/" intent="ghost">
              Затвори
            </Pill>
          )}

          {step === "review" ? (
            <Pill
              type="submit"
              intent="primary"
              shimmer
              tracked
              disabled={status === "submitting"}
            >
              {status === "submitting" ? "Изпращаме..." : "Изпрати сигнал"}
            </Pill>
          ) : (
            <Pill type="button" intent="primary" shimmer tracked onClick={advance}>
              Напред →
            </Pill>
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
  identity: "private" | "identified";
  type: ReportType;
}) {
  const meta = TYPE_META[type];

  return (
    <section role="status" aria-label="Сигналът е получен">
      <EmptyState
        artifact={<ArtifactImage artifact="sealed-letter" />}
        title="Светилникът свети."
        body={`Получихме сигнала ти за ${meta.label.toLowerCase()}. Преглеждаме в рамките на 48 часа.`}
        action={
          <div className={styles.successStack}>
            {referenceId ? (
              <div className={styles.successReference}>
                <p className={styles.successRefLabel}>Референция</p>
                <p className={styles.successRefValue}>{referenceId}</p>
                <p className={styles.successRefHint}>
                  Запази я, ако искаш да се позовеш на този сигнал по-късно.
                </p>
              </div>
            ) : null}

            {identity === "identified" ? (
              <p className={styles.successFollowup}>Ще получиш отговор на посочения имейл.</p>
            ) : (
              <p className={styles.successFollowup}>
                Сигналът е анонимен — няма да получиш потвърждение.
              </p>
            )}

            <div className={styles.successActions}>
              <Pill as="a" href="/" intent="secondary" tracked>
                Към началото
              </Pill>
              <Pill as="a" href="/account" intent="secondary" tracked>
                Към досието
              </Pill>
            </div>
          </div>
        }
      />
    </section>
  );
}
