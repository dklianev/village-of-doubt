import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { tutorialDestination } from "./tutorial-destination";

export const TUTORIAL_SCENE_LABELS = ["Събиране", "Нощ", "Ден", "Глас", "Развръзка", "Начало"] as const;

interface TutorialProgressProps {
  current: number;
  onJump: (slide: number) => void;
  continueHref: string | null;
  ready: boolean;
}

// Firefox also applies autocomplete to buttons when restoring disabled state.
export function TutorialProgress({ current, onJump, continueHref, ready }: TutorialProgressProps) {
  const scenes = TUTORIAL_SCENE_LABELS;
  const total = scenes.length;
  const destination = continueHref ? tutorialDestination(continueHref) : null;

  return (
    <nav className="tutorial-progress" aria-label="Ход на репетицията">
      <div className="tutorial-progress-bar" aria-hidden="true">
        <div className="tutorial-progress-fill" style={{ width: `${(current / total) * 100}%` }} />
      </div>

      <label className="tutorial-progress-mobile">
        <span className="sr-only">Сцена</span>
        <select value={current} autoComplete="off" disabled={!ready} onChange={(event) => onJump(Number(event.target.value))}>
          {scenes.map((label, index) => (
            <option key={label} value={index + 1}>
              {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")} - {label}
            </option>
          ))}
        </select>
      </label>

      <div className="tutorial-progress-dots">
        {scenes.map((label, index) => {
          const slide = index + 1;
          const isActive = slide === current;
          const isPast = slide < current;
          return (
            <button
              key={label}
              type="button"
              {...{ autoComplete: "off" }}
              disabled={!ready}
              aria-current={isActive ? "step" : undefined}
              aria-label={`${slide}. ${label}`}
              data-state={isActive ? "active" : isPast ? "past" : "future"}
              onClick={() => onJump(slide)}
              className="tutorial-progress-dot"
            >
              <span className="tutorial-progress-number" aria-hidden>
                {String(slide).padStart(2, "0")}
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {continueHref ? (
        <Link href={continueHref} prefetch={false} className="tutorial-skip-link">
          <span>{destination?.invitation ? "Към поканата" : destination?.name ? `Към ${destination.name}` : "Към запазената страница"}</span>
          <ArrowRight className="tutorial-skip-icon" aria-hidden />
        </Link>
      ) : current < total ? (
        <button type="button" {...{ autoComplete: "off" }} className="tutorial-skip-link" disabled={!ready} onClick={() => onJump(total)}>
          <span>Избери игра</span>
          <ArrowRight className="tutorial-skip-icon" aria-hidden />
        </button>
      ) : null}
    </nav>
  );
}
