import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface TutorialProgressProps {
  current: number;
  total: number;
  onJump: (slide: number) => void;
}

export function TutorialProgress({ current, total, onJump }: TutorialProgressProps) {
  const scenes = ["Събиране", "Нощ", "Ден", "Глас", "Развръзка", "Начало"].slice(0, total);

  return (
    <nav className="tutorial-progress" aria-label="Ход на репетицията">
      <div className="tutorial-progress-bar" aria-hidden="true">
        <div className="tutorial-progress-fill" style={{ width: `${(current / total) * 100}%` }} />
      </div>

      <div className="tutorial-progress-dots">
        {scenes.map((label, index) => {
          const slide = index + 1;
          const isActive = slide === current;
          const isPast = slide < current;
          return (
            <button
              key={label}
              type="button"
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

      <Link href="/" prefetch={false} className="tutorial-skip-link">
        <span>Прескочи</span>
        <ChevronRight className="tutorial-skip-icon" aria-hidden strokeWidth={2} />
      </Link>
    </nav>
  );
}
