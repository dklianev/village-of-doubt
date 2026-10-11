"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock3, Eye, Lightbulb } from "lucide-react";
import { phaseLabelBg, type GameMode, type GamePhase } from "@werewolf/shared";
import { NearViewportMedia } from "@/components/NearViewportMedia";

// Both rules interactions enter through this existing client boundary.
export { GameRulesContents } from "./GameRulesContents";

export interface GameRulesPhase {
  id: string;
  phase: GamePhase;
  title: string;
  body: string;
  action: string;
  timer: string;
  wakes: string;
  example: string;
}

const WEREWOLF_PHASE_ART = {
  lobby: { src: "/game-art/rules/werewolf-gathering-v1.webp", width: 1484, height: 1060 },
  "role-reveal": { src: "/game-art/rules/werewolf-secret-card-v1.webp", width: 1484, height: 1060 },
  night: { src: "/game-art/werewolf/night-1-fog.webp", width: 1448, height: 1086 },
  day: { src: "/game-art/werewolf/bg-hero-light-v1.webp", width: 1672, height: 941 },
  voting: { src: "/game-art/rules/werewolf-vote-v1.webp", width: 1484, height: 1060 },
  resolution: { src: "/game-art/werewolf/night-5-dawn.webp", width: 1448, height: 1086 },
};

const PHASE_ICONS: Record<GamePhase, keyof typeof WEREWOLF_PHASE_ART> = {
  lobby: "lobby", role_reveal: "role-reveal", first_night: "night", night: "night",
  day_announcement: "day", day_discussion: "day", nomination: "voting", defense: "voting",
  voting: "voting", resolution: "resolution", hunter_revenge: "resolution",
  mayor_successor: "resolution", paused: "lobby", game_over: "resolution",
};

function phaseArt(phase: GamePhase, mafia: boolean) {
  if (!mafia) return WEREWOLF_PHASE_ART[PHASE_ICONS[phase]];
  return { src: `/game-art/phase-board/v1/mafia/icon-phase-${PHASE_ICONS[phase]}-1120.webp`, width: 1120, height: 800 };
}

function phaseArtSizes(art: { width: number; height: number }) {
  const aspect = art.width / art.height;
  // Cover uses the uncropped width: rail content heights are 116/136px.
  // Desktop detail occupies .78 / 2.18 of the shell and has a 7:6 crop.
  const detailScale = (0.78 / 2.18) * Math.max(1, aspect * 6 / 7);
  return {
    thumbnail: `(max-width: 760px) ${Math.max(164, Math.ceil(116 * aspect))}px, ${Math.max(192, Math.ceil(136 * aspect))}px`,
    detail: `(max-width: 760px) 1px, (max-width: 980px) calc(100vw - 50px), calc((min(100vw, 1228px) - 50px) * ${detailScale})`,
  };
}

export function GameRulesPhaseTimeline({ phases, mode, sportPhases }: {
  phases: GameRulesPhase[];
  mode: GameMode;
  sportPhases?: GameRulesPhase[];
}) {
  const [selectedMode, setSelectedMode] = useState(mode);
  const [activeId, setActiveId] = useState(phases[0]?.id ?? "");
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const selectedPhases = selectedMode === "mafia_sport" && sportPhases ? sportPhases : phases;
  const activeIndex = Math.max(0, selectedPhases.findIndex((phase) => phase.id === activeId));
  const active = selectedPhases[activeIndex];
  const mafia = selectedMode.startsWith("mafia");
  if (!active) return null;
  const activeArt = phaseArt(active.phase, mafia);
  const flavor = phaseLabelBg(active.phase, selectedMode);
  const tutorialRedirect = selectedMode === "mafia_sport" ? "/mafia/create?mode=mafia_sport" : "/mafia/create";

  function selectMode(nextMode: GameMode) {
    setSelectedMode(nextMode);
    if (nextMode === "mafia_free" && !phases.some((phase) => phase.id === activeId)) {
      setActiveId("day");
    }
  }

  function selectPhase(id: string) {
    setActiveId(id);
    // Keep the result visible without moving a page that already shows it.
    requestAnimationFrame(() => {
      const heading = detailHeading.current;
      if (!heading) return;
      const selectedNode = rail.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (rail.current && selectedNode) {
        const container = rail.current.getBoundingClientRect();
        const node = selectedNode.getBoundingClientRect();
        if (node.left < container.left) rail.current.scrollLeft -= container.left - node.left + 4;
        else if (node.right > container.right) rail.current.scrollLeft += node.right - container.right + 4;
      }
      // Follow the selected result with focus as well as the viewport.
      heading.focus({ preventScroll: true });
      const { top, bottom } = heading.getBoundingClientRect();
      if (top < (window.innerWidth <= 760 ? 144 : 88) || bottom > window.innerHeight - 24) {
        heading.scrollIntoView({ block: "start", behavior: "instant" });
      }
    });
  }

  return (
    <section id="rules-phases" className="phase-timeline-section rules-phase-timeline" data-mode={selectedMode} aria-labelledby="phase-timeline-title">
      <header className="phase-timeline-header">
        <div><p className="section-kicker">Ритъмът на вечерта</p><h2 id="phase-timeline-title">Ход на играта</h2></div>
        <p>Нощта пази тайните. Денят ги поставя на изпитание.</p>
      </header>
      {mafia && sportPhases ? (
        <div className="rules-format">
          <fieldset className="rules-format-options">
            <legend>Формат на Мафия</legend>
            {(["mafia_free", "mafia_sport"] as const).map((format) => (
              <label key={format}>
                <input type="radio" name="rules-mafia-format" value={format} checked={selectedMode === format} onChange={() => selectMode(format)} />
                <span>{format === "mafia_free" ? "Свободна" : "Спортна"}</span>
              </label>
            ))}
          </fieldset>
          <p>{selectedMode === "mafia_sport"
            ? "10 играчи: речи по ред, номинации, защити и вот само за номинираните."
            : "4-24 играчи: общо обсъждане и директен вот, с роли по избор."}</p>
          <Link href={`/tutorial?game=${selectedMode}&redirect=${encodeURIComponent(tutorialRedirect)}`} className="rules-text-link" prefetch={false}>
            {selectedMode === "mafia_sport" ? "Наръчник за спортна Мафия" : "Наръчник за свободна Мафия"} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : null}
      <div ref={rail} className="phase-timeline" role="group" aria-label="Фази">
        {selectedPhases.map((phase, index) => {
          const art = phaseArt(phase.phase, mafia);
          const phaseFlavor = phaseLabelBg(phase.phase, selectedMode);
          return (
            <button key={phase.id} type="button" className={phase.id === active.id ? "phase-node is-selected" : "phase-node"}
              data-phase={phase.phase} aria-pressed={phase.id === active.id} aria-controls="phase-detail-panel"
              onClick={() => selectPhase(phase.id)}>
              <NearViewportMedia>
                <Image className="phase-node-medallion" {...art} alt=""
                  sizes={phaseArtSizes(art).thumbnail} quality={85}
                  loading="lazy" decoding="async" fetchPriority="low" />
              </NearViewportMedia>
              <span className="phase-node-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="phase-node-copy">
                <span className="phase-node-label">{phase.title}</span>
                {phaseFlavor !== phase.title ? <span className="phase-node-flavor">{phaseFlavor}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      <article id="phase-detail-panel" className="phase-detail-panel" aria-labelledby="phase-detail-title">
        <div className="phase-detail-art" aria-hidden="true">
          <NearViewportMedia>
            <Image {...activeArt} alt=""
              sizes={phaseArtSizes(activeArt).detail} quality={85} loading="lazy" decoding="async" />
          </NearViewportMedia>
        </div>
        <div className="phase-detail-copy">
          <header className="phase-detail-panel__lead">
            {flavor === active.title ? <p className="section-kicker">Фаза {activeIndex + 1} от {selectedPhases.length}</p> : null}
            <h3 ref={detailHeading} id="phase-detail-title" tabIndex={-1}>
              {active.title}{flavor !== active.title ? <> <span className="phase-detail-flavor">{flavor}</span></> : null}
            </h3>
            <p>{active.body}</p>
          </header>
          <div className="phase-player-action"><h4>Какво правиш ти</h4><p>{active.action}</p></div>
          <dl className="phase-info-grid">
            <div className="phase-info-chip"><dt><Clock3 size={16} aria-hidden="true" />Обичайно време</dt><dd>{active.timer}</dd></div>
            <div className="phase-info-chip"><dt><Eye size={16} aria-hidden="true" />Кой действа</dt><dd>{active.wakes}</dd></div>
            <div className="phase-info-chip"><dt><Lightbulb size={16} aria-hidden="true" />Пример</dt><dd>{active.example}</dd></div>
          </dl>
          <nav className="phase-step-navigation" aria-label="Смяна на фаза">
            <button type="button" aria-label="Предишна фаза" title="Предишна фаза" disabled={activeIndex === 0}
              onClick={() => selectPhase(selectedPhases[activeIndex - 1]!.id)}><ArrowLeft size={20} aria-hidden="true" /></button>
            <span>{activeIndex + 1} / {selectedPhases.length}<strong>{active.title}</strong></span>
            <button type="button" aria-label="Следваща фаза" title="Следваща фаза" disabled={activeIndex === selectedPhases.length - 1}
              onClick={() => selectPhase(selectedPhases[activeIndex + 1]!.id)}><ArrowRight size={20} aria-hidden="true" /></button>
          </nav>
        </div>
      </article>
      <p className="rules-phase-announcement" role="status">Избрана фаза: {active.title}{flavor !== active.title ? `, ${flavor}` : ""}. {activeIndex + 1} от {selectedPhases.length}.</p>
      <p className="phase-cycle-note">След развръзката започва нова нощ, докато една страна не спечели. Времената зависят от настройките на стаята.</p>
    </section>
  );
}
