"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlideDay } from "./SlideDay";
import { SlideFinal } from "./SlideFinal";
import { SlideNight } from "./SlideNight";
import { SlideResolution } from "./SlideResolution";
import { SlideSetup } from "./SlideSetup";
import { SlideVote } from "./SlideVote";
import { TutorialProgress } from "./TutorialProgress";

const TOTAL_SLIDES = 6;
const STORAGE_KEY_COMPLETED = "tutorial-completed";
const STORAGE_KEY_LAST_SLIDE = "tutorial-last-slide";

export function TutorialFlipbook() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [current, setCurrent] = useState(1);

  useEffect(() => {
    const fromUrl = Number(searchParams.get("step"));
    if (Number.isFinite(fromUrl) && fromUrl >= 1 && fromUrl <= TOTAL_SLIDES) {
      setCurrent(fromUrl);
      return;
    }

    const stored = Number(window.localStorage.getItem(STORAGE_KEY_LAST_SLIDE));
    if (Number.isFinite(stored) && stored >= 1 && stored <= TOTAL_SLIDES) {
      setCurrent(stored);
    }
    // We only restore once on mount; later changes are driven by local state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", String(current));
    router.replace(`/tutorial?${params.toString()}`, { scroll: false });
    window.localStorage.setItem(STORAGE_KEY_LAST_SLIDE, String(current));
    if (current === TOTAL_SLIDES) {
      window.localStorage.setItem(STORAGE_KEY_COMPLETED, "1");
    }
    // Avoid reacting to searchParams changes caused by this same replace call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, router]);

  const goTo = useCallback((slide: number) => {
    if (slide < 1 || slide > TOTAL_SLIDES) {
      return;
    }
    setCurrent(slide);
  }, []);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA") {
        return;
      }
      if (event.key === "ArrowRight") {
        next();
      }
      if (event.key === "ArrowLeft") {
        prev();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const slide = useMemo(() => {
    switch (current) {
      case 1:
        return <SlideSetup />;
      case 2:
        return <SlideNight />;
      case 3:
        return <SlideDay />;
      case 4:
        return <SlideVote />;
      case 5:
        return <SlideResolution />;
      case 6:
        return <SlideFinal />;
      default:
        return <SlideSetup />;
    }
  }, [current]);

  return (
    <section className="tutorial-flipbook" aria-label="Наръчник за първа игра">
      <TutorialProgress current={current} total={TOTAL_SLIDES} onJump={goTo} />

      <div className="tutorial-slide-stage" role="region">
        {slide}
      </div>

      <nav className="tutorial-nav" aria-label="Навигация между сцените">
        <button type="button" className="btn btn-secondary" onClick={prev} disabled={current === 1} aria-label="Предишна сцена">
          Назад
        </button>
        <span className="tutorial-nav-counter">
          Сцена {current} от {TOTAL_SLIDES}
        </span>
        <button
          type="button"
          className="btn btn-primary"
          onClick={next}
          disabled={current === TOTAL_SLIDES}
          aria-label="Следваща сцена"
        >
          Напред
        </button>
      </nav>

      {current === 1 ? <p className="tutorial-keyboard-hint">Съвет: стрелките наляво и надясно сменят сцената.</p> : null}
    </section>
  );
}
