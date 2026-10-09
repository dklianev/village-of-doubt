"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { safeLocalStorage } from "@/lib/safe-storage";
import { safeInternalRedirect } from "@/lib/safe-internal-redirect";
import { TutorialProgress, TUTORIAL_SCENE_LABELS as SCENE_LABELS } from "./TutorialProgress";
import { TutorialSceneLoader } from "./TutorialSceneLoader";
import { TUTORIAL_MODES, readPractice, tutorialMode, tutorialWorld, type TutorialMode, type TutorialPractice } from "./tutorial-scenario";

const TOTAL_SLIDES = SCENE_LABELS.length;
const SCENE_IDS = ["setup", "night", "day", "vote", "resolution", "final"] as const;
const STORAGE_KEY_COMPLETED = "tutorial-completed";
const STORAGE_KEY_LAST_SLIDE = "tutorial-last-slide";

function readSlide(searchParams: Pick<URLSearchParams, "get">): number {
  const fromUrl = Number(searchParams.get("step"));
  if (Number.isInteger(fromUrl) && fromUrl >= 1 && fromUrl <= TOTAL_SLIDES) {
    return fromUrl;
  }

  return 1;
}

function replaceSlide(slide: number) {
  const params = new URLSearchParams(window.location.search);
  params.set("step", String(slide));
  window.history.replaceState(null, "", `/tutorial?${params.toString()}${window.location.hash}`);
}

type SetupScenes = Record<TutorialMode, ReactNode>;

export function TutorialFlipbook({ setupScenes }: { setupScenes: SetupScenes }) {
  const searchParams = useSearchParams();
  const continueHref = safeInternalRedirect(searchParams.get("redirect"), "") || null;
  const mode = tutorialMode(searchParams.get("game"), continueHref);
  return <TutorialSession key={mode} mode={mode} continueHref={continueHref} setupScene={setupScenes[mode]} />;
}

function TutorialSession({ mode, continueHref, setupScene }: { mode: TutorialMode; continueHref: string | null; setupScene: ReactNode }) {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const current = readSlide(searchParams);
  const [welcomeVisible, setWelcomeVisible] = useState(() => searchParams.get("welcome") === "1");
  const [practice, setPractice] = useState<TutorialPractice | null>(null);
  const ready = practice !== null;
  const practiceKey = `tutorial-practice-v1:${mode}`;
  const world = tutorialWorld(mode);
  const stageRef = useRef<HTMLDivElement>(null);
  const [reservedHeight, setReservedHeight] = useState(0);
  const navigationStartedRef = useRef(false);

  useEffect(() => {
    setPractice(readPractice(safeLocalStorage.getJson(practiceKey)));
  }, [practiceKey]);

  const onPracticeChange = useCallback((next: TutorialPractice) => {
    setPractice(next);
    safeLocalStorage.setJson(practiceKey, next);
  }, [practiceKey]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // A cached route can render with old params while navigation is settling.
    if (window.location.pathname !== "/tutorial" || params.toString() !== query) return;
    let slide = readSlide(params);
    if (!params.has("step")) {
      // The legacy key has no family; only trust it before any per-mode progress exists.
      const legacy = !params.has("game") && !continueHref
        && TUTORIAL_MODES.every((game) => safeLocalStorage.getItem(`${STORAGE_KEY_LAST_SLIDE}:${game}`) === null)
        ? safeLocalStorage.getItem(STORAGE_KEY_LAST_SLIDE) : null;
      const stored = Number(safeLocalStorage.getItem(`${STORAGE_KEY_LAST_SLIDE}:${mode}`)
        ?? legacy);
      if (Number.isInteger(stored) && stored >= 1 && stored <= TOTAL_SLIDES) slide = stored;
    }
    if (params.get("step") !== String(slide)) replaceSlide(slide);
    safeLocalStorage.setItem(STORAGE_KEY_LAST_SLIDE, String(slide));
    safeLocalStorage.setItem(`${STORAGE_KEY_LAST_SLIDE}:${mode}`, String(slide));
    if (slide === TOTAL_SLIDES) {
      safeLocalStorage.setItem(STORAGE_KEY_COMPLETED, "1");
    }
  }, [query, mode, continueHref]);

  const goTo = useCallback((slide: number) => {
    if (!Number.isInteger(slide) || slide < 1 || slide > TOTAL_SLIDES) {
      return;
    }
    navigationStartedRef.current = true;
    setReservedHeight(stageRef.current?.getBoundingClientRect().height ?? 0);
    replaceSlide(slide);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable], button, a")) {
        return;
      }
      if (event.key === "ArrowRight") {
        goTo(current + 1);
      }
      if (event.key === "ArrowLeft") {
        goTo(current - 1);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, goTo]);

  useEffect(() => {
    if (navigationStartedRef.current) {
      stageRef.current?.focus();
    }
  }, [current]);

  useEffect(() => {
    if (!welcomeVisible) {
      return;
    }

    const timer = window.setTimeout(() => setWelcomeVisible(false), 6000);
    return () => window.clearTimeout(timer);
  }, [welcomeVisible]);

  const sceneProps = { mode, practice: practice ?? readPractice(null), onPracticeChange, continueHref, onScene: goTo };
  const lighting = current === 2 || current >= 5 ? "night" : "day";
  const art = world.mafia
    ? `/game-art/phase-board/v1/mafia/icon-phase-${lighting}-1120.webp`
    : `/game-art/tutorial-${lighting}-scene.avif`;
  const slide = current >= 2 && current <= 6
    ? <TutorialSceneLoader slide={current as 2 | 3 | 4 | 5 | 6} {...sceneProps}
        reservedHeight={reservedHeight} onRetryFocus={() => stageRef.current?.focus()} />
    : setupScene;
  return (
    <section className="tutorial-flipbook" aria-label="Наръчник за първа игра" data-family={world.family}>
      <link rel="preload" as="image" type={world.mafia ? "image/webp" : "image/avif"} fetchPriority="high" href={art}
        media={world.mafia ? undefined : "(min-width: 481px), (resolution > 2dppx)"} />
      {!world.mafia ? <link rel="preload" as="image" type="image/avif" fetchPriority="high"
        href={`/game-art/mobile/tutorial-${lighting}-scene-960.avif`} media="(max-width: 480px) and (max-resolution: 2dppx)" /> : null}
      <div className="tutorial-edition">
        <span className="tutorial-edition-kicker">Първата ти вечер</span>
        <label htmlFor="tutorial-game"><span>Игра</span>
          <select id="tutorial-game" value={mode} autoComplete="off" disabled={!ready} onChange={(event) => {
            const params = new URLSearchParams(window.location.search);
            params.set("game", event.target.value);
            window.history.pushState(null, "", `/tutorial?${params.toString()}${window.location.hash}`);
          }}>
            <option value="werewolves_classic">Върколак</option>
            <option value="mafia_free">Мафия</option>
            <option value="mafia_sport">Спортна Мафия</option>
          </select>
        </label>
        <p>Учебна маса. Без истински играчи.</p>
      </div>
      {welcomeVisible ? (
        <aside className="tutorial-welcome-banner" role="status">
          <p>
            <strong>Добре дошъл на масата.</strong> Да започнем с най-важното.
          </p>
          <button type="button" {...{ autoComplete: "off" }} disabled={!ready} onClick={() => setWelcomeVisible(false)} aria-label="Затвори">
            <X aria-hidden />
          </button>
        </aside>
      ) : null}

      <TutorialProgress current={current} onJump={goTo} continueHref={continueHref} ready={ready} />

      <div
        ref={stageRef}
        className="tutorial-slide-stage"
        role="region"
        aria-label={`Сцена ${current}: ${SCENE_LABELS[current - 1]}`}
        data-tutorial-scene={SCENE_IDS[current - 1]}
        tabIndex={-1}
      >
        {slide}
      </div>

      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Сцена {current} от {TOTAL_SLIDES}: {SCENE_LABELS[current - 1]}
      </span>

      <nav className="tutorial-nav" aria-label="Навигация между сцените">
        <button type="button" {...{ autoComplete: "off" }} className="btn btn-secondary" onClick={() => goTo(current - 1)} disabled={!ready || current === 1} aria-label="Предишна сцена">
          <ArrowLeft aria-hidden size={18} />
          Назад
        </button>
        <span className="tutorial-nav-counter">
          <strong>{SCENE_LABELS[current - 1]}</strong>
          <span>Сцена {current} от {TOTAL_SLIDES}</span>
        </span>
        {current === TOTAL_SLIDES ? null : (
          <button
            type="button"
            {...{ autoComplete: "off" }}
            className="btn btn-primary tutorial-nav-action"
            onClick={() => goTo(current + 1)}
            disabled={!ready}
            aria-label="Следваща сцена"
          >
            Напред
            <ArrowRight aria-hidden size={18} />
          </button>
        )}
      </nav>
    </section>
  );
}
