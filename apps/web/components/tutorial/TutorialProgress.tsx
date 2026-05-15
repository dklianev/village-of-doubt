"use client";

import Link from "next/link";

interface TutorialProgressProps {
  current: number;
  total: number;
  onJump: (slide: number) => void;
}

export function TutorialProgress({ current, total, onJump }: TutorialProgressProps) {
  return (
    <header className="tutorial-progress">
      <div className="tutorial-progress-bar" aria-hidden="true">
        <div className="tutorial-progress-fill" style={{ width: `${(current / total) * 100}%` }} />
      </div>

      <div className="tutorial-progress-dots" role="tablist" aria-label="Сцени">
        {Array.from({ length: total }, (_, index) => {
          const slide = index + 1;
          const isActive = slide === current;
          const isPast = slide < current;
          return (
            <button
              key={slide}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Сцена ${slide}`}
              data-state={isActive ? "active" : isPast ? "past" : "future"}
              onClick={() => onJump(slide)}
              className="tutorial-progress-dot"
            />
          );
        })}
      </div>

      <Link href="/" className="tutorial-skip-link">
        Прескочи
      </Link>
    </header>
  );
}
