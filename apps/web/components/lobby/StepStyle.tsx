"use client";

import type { Dispatch } from "react";
import { NARRATOR_VOICE_LABELS_BG, type CommunicationMode, type NarratorMode, type NarratorVoice } from "@werewolf/shared";
import type { LobbyFormAction, LobbyFormState } from "@/lib/lobby-form";
import { AdvancedDrawer } from "@/components/lobby/AdvancedDrawer";

const NARRATOR_CARDS: { value: NarratorMode; label: string; detail: string }[] = [
  { value: "automatic", label: "Автоматичен", detail: "Сървърът води фазите и пази тайните роли." },
  { value: "honest_human", label: "Честен", detail: "Водещият помага без да вижда тайните роли." },
  { value: "full_human", label: "Пълен", detail: "Водещият вижда всичко и управлява играта на ръка." },
];

const COMMUNICATION_CARDS: { value: CommunicationMode; label: string; detail: string }[] = [
  { value: "built_in_chat", label: "Вграден чат", detail: "Играчите пишат директно в стаята." },
  { value: "no_chat", label: "Без чат", detail: "Подходящо за разговор на живо или външен гласов канал." },
  { value: "system_only", label: "Само системни", detail: "Видими са фазите, резултатите и служебните съобщения." },
];

const VOICE_DETAILS: Record<NarratorVoice, string> = {
  classic: "спокоен тон",
  old_villager: "суха селска мъдрост",
  inspector: "криминален ритъм",
  witch: "по-мрачен шепот",
};

export function StepStyle({
  state,
  dispatch,
}: {
  state: LobbyFormState;
  dispatch: Dispatch<LobbyFormAction>;
}) {
  return (
    <section className="lobby-step lobby-step-style" aria-labelledby="step-style-title">
      <div className="lobby-step-heading">
        <p className="section-kicker">стъпка 3</p>
        <h1 id="step-style-title">Стил на водене</h1>
        <p>Избери колко автоматична да бъде играта и как да общуват играчите.</p>
      </div>

      <section className="lobby-panel">
        <div className="lobby-panel-title">
          <h2>Разказвач</h2>
        </div>
        <div className="wizard-choice-grid">
          {NARRATOR_CARDS.map((card) => (
            <button
              key={card.value}
              type="button"
              className="narrator-tile"
              data-active={state.narratorMode === card.value}
              onClick={() => dispatch({ type: "SET_NARRATOR_MODE", narratorMode: card.value })}
            >
              <strong>{card.label}</strong>
              <span>{card.detail}</span>
            </button>
          ))}
        </div>
        {state.narratorMode === "full_human" ? (
          <p className="narrator-warning">
            Пълен Разказвач вижда всички роли и действия. Играчите ще трябва да го приемат съзнателно преди старт.
          </p>
        ) : null}
      </section>

      {state.narratorMode === "automatic" ? (
        <section className="lobby-panel">
          <div className="lobby-panel-title">
            <h2>Глас</h2>
          </div>
          <div className="voice-card-grid">
            {(Object.entries(NARRATOR_VOICE_LABELS_BG) as [NarratorVoice, string][]).map(([voice, label]) => (
              <button
                key={voice}
                type="button"
                className="voice-tile"
                data-active={state.advanced.narratorVoice === voice}
                onClick={() => dispatch({ type: "SET_ADVANCED", key: "narratorVoice", value: voice })}
              >
                <strong>{label}</strong>
                <span>{VOICE_DETAILS[voice]}</span>
                <small>Проба</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="lobby-panel">
        <div className="lobby-panel-title">
          <h2>Комуникация</h2>
        </div>
        <div className="wizard-choice-grid">
          {COMMUNICATION_CARDS.map((card) => (
            <button
              key={card.value}
              type="button"
              className="communication-tile"
              data-active={state.communicationMode === card.value}
              onClick={() => dispatch({ type: "SET_COMMUNICATION_MODE", communicationMode: card.value })}
            >
              <strong>{card.label}</strong>
              <span>{card.detail}</span>
            </button>
          ))}
        </div>
      </section>

      <AdvancedDrawer state={state} dispatch={dispatch} />
    </section>
  );
}
