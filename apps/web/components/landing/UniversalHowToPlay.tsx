import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  BallotIcon,
  HouseIcon,
  KeyIcon,
  MaskIcon,
  MoonIcon,
} from "@/components/landing/quickstart-icons";

const STEPS = [
  {
    label: "Вход",
    body: "Влизаш с Google, Discord или имейл.",
    icon: <KeyIcon />,
  },
  {
    label: "Стая",
    body: "Създаваш стая или влизаш при приятел с код.",
    icon: <HouseIcon />,
  },
  {
    label: "Роля",
    body: "Виждаш само собствената си роля. Чуждите тайни остават скрити.",
    icon: <MaskIcon />,
  },
  {
    label: "Нощ",
    body: "Когато дойде редът ти, действаш без другите да разберат.",
    icon: <MoonIcon />,
  },
  {
    label: "Гласуване",
    body: "Обсъждате, обвинявате и решавате кой напуска играта.",
    icon: <BallotIcon />,
  },
] as const;

export function UniversalHowToPlay() {
  return (
    <section className="landing-quickstart how-to-play" aria-label="Първа игра за 30 секунди">
      <div className="quickstart-surface">
        <div className="quickstart-header">
          <div className="quickstart-header-plaque">
            <p className="section-kicker">първа игра за 30 секунди</p>
            <h2>Как започва добра игра</h2>
            <p>Създай стая, сподели кода и започнете.</p>
          </div>
          <Link href="/faq" className="quickstart-rules-cta">
            Виж правилата и отговорите <span aria-hidden="true">→</span>
          </Link>
        </div>

        <ol className="quickstart-steps" data-revealed="true">
          {STEPS.map((step, index) => (
            <li
              key={step.label}
              className="quickstart-step-slot"
              style={{ "--connector-index": index } as CSSProperties & Record<"--connector-index", number>}
            >
              <StepMedallion number={index + 1} icon={step.icon} label={step.label} body={step.body} />
              {index < STEPS.length - 1 ? <StepConnector /> : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function StepMedallion({ number, icon, label, body }: { number: number; icon: ReactNode; label: string; body: string }) {
  return (
    <article className="quickstart-step">
      <span className="quickstart-medallion">{number}</span>
      <span className="quickstart-glyph">{icon}</span>
      <h3>{label}</h3>
      <p>{body}</p>
    </article>
  );
}

function StepConnector() {
  return (
    <span className="quickstart-connector" aria-hidden="true">
      <i />
      <i />
    </span>
  );
}
