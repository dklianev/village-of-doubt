"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
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

function readInitialSlide(searchParams: Pick<URLSearchParams, "get">): number {
  const fromUrl = Number(searchParams.get("step"));
  if (Number.isFinite(fromUrl) && fromUrl >= 1 && fromUrl <= TOTAL_SLIDES) {
    return fromUrl;
  }

  return 1;
}

export function TutorialFlipbook() {
  const searchParams = useSearchParams();
  const [current, setCurrent] = useState(() => readInitialSlide(searchParams));
  const [hydrated, setHydrated] = useState(false);
  const [welcomeVisible, setWelcomeVisible] = useState(() => searchParams.get("welcome") === "1");
  const urlUpdateTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (searchParams.get("step")) {
      setHydrated(true);
      return;
    }

    const stored = Number(window.localStorage.getItem(STORAGE_KEY_LAST_SLIDE));
    if (Number.isFinite(stored) && stored >= 1 && stored <= TOTAL_SLIDES) {
      setCurrent(stored);
    }
    setHydrated(true);
    // We only restore once on mount; later changes are driven by local state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("step", String(current));
    if (urlUpdateTimerRef.current !== null) {
      window.clearTimeout(urlUpdateTimerRef.current);
    }
    urlUpdateTimerRef.current = window.setTimeout(() => {
      window.history.replaceState(null, "", `/tutorial?${params.toString()}`);
      urlUpdateTimerRef.current = null;
    }, 300);
    window.localStorage.setItem(STORAGE_KEY_LAST_SLIDE, String(current));
    if (current === TOTAL_SLIDES) {
      window.localStorage.setItem(STORAGE_KEY_COMPLETED, "1");
    }
    // Avoid reacting to searchParams changes caused by this same replace call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, hydrated]);

  useEffect(() => {
    return () => {
      if (urlUpdateTimerRef.current !== null) {
        window.clearTimeout(urlUpdateTimerRef.current);
      }
    };
  }, []);

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
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable], button, a")) {
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

  useEffect(() => {
    if (!welcomeVisible) {
      return;
    }

    const timer = window.setTimeout(() => setWelcomeVisible(false), 6000);
    return () => window.clearTimeout(timer);
  }, [welcomeVisible]);

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
      {welcomeVisible ? (
        <aside className="tutorial-welcome-banner" role="status">
          <p>
            <span>добре дошъл</span>
            <strong>Играч,</strong> ето кратък пробег през първата игра.
          </p>
          <button type="button" onClick={() => setWelcomeVisible(false)} aria-label="Затвори">
            <X aria-hidden strokeWidth={2} />
          </button>
        </aside>
      ) : null}

      <TutorialProgress current={current} total={TOTAL_SLIDES} onJump={goTo} />

      <nav className="tutorial-nav" aria-label="Навигация между сцените">
        <button type="button" className="btn btn-secondary" onClick={prev} disabled={current === 1} aria-label="Предишна сцена">
          Назад
        </button>
        <span className="tutorial-nav-counter">
          Сцена {current} от {TOTAL_SLIDES}
        </span>
        <Link href="/werewolf/create" className="btn btn-secondary tutorial-play-link">
          Към играта
        </Link>
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

      <div className="tutorial-slide-stage" role="region">
        {slide}
      </div>

      {current === 1 ? <p className="tutorial-keyboard-hint">Съвет: стрелките наляво и надясно сменят сцената.</p> : null}
    </section>
  );
}
