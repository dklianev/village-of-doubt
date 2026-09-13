import {
  Check,
  Clock3,
  Minus,
  Monitor,
  Plus,
  Settings2,
  Users,
} from "lucide-react";
import {
  ROLE_DEFINITIONS,
  type CommunicationMode,
  type RoleCode,
  type RoleDistribution,
  type RolePreset,
} from "@werewolf/shared";
import type { Dispatch } from "react";
import {
  boundedPlayerCount,
  criticalRoleWarnings,
  currentConfig,
  estimatedDurationSeconds,
  formatEstimatedDuration,
  playerRange,
  type LobbyFormAction,
  type LobbyFormState,
  type LobbyTemplate,
} from "@/lib/lobby-form";
import { roleThumbStyle } from "@/lib/role-art";

type Experience = {
  id: string;
  title: string;
  eyebrow: string;
  detail: string;
  rolePreset: RolePreset;
  mode: LobbyFormState["mode"];
  advanced?: LobbyTemplate["advanced"];
};

const COMMUNICATION_LABELS: Record<CommunicationMode, string> = {
  built_in_chat: "Вграден разговор",
  no_chat: "Без писмен разговор",
  system_only: "Системни съобщения",
  secret_channels: "Тайни канали",
};

const WEREWOLF_EXPERIENCES: Experience[] = [
  {
    id: "first-night",
    eyebrow: "за нова група",
    title: "Първа нощ",
    detail: "Основните роли, лесни за първа игра.",
    mode: "werewolves_classic",
    rolePreset: "beginner",
  },
  {
    id: "classic-village",
    eyebrow: "препоръчано",
    title: "Класическо село",
    detail: "Баланс между разследване, защита и тайна любов.",
    mode: "werewolves_classic",
    rolePreset: "classic",
  },
  {
    id: "village-secrets",
    eyebrow: "за опитна маса",
    title: "Село с тайни",
    detail: "Повече специални роли и неочаквани обрати.",
    mode: "werewolves_classic",
    rolePreset: "advanced",
    advanced: { loversEnabled: true },
  },
];

const MAFIA_EXPERIENCES: Experience[] = [
  {
    id: "free-table",
    eyebrow: "гъвкав формат",
    title: "Свободна маса",
    detail: "Настройва се спрямо групата и оставя повече свобода на водещия.",
    mode: "mafia_free",
    rolePreset: "free",
  },
  {
    id: "sport-table",
    eyebrow: "официален състав",
    title: "Спортна маса",
    detail: "Точно 10 играчи, фиксирани роли и състезателно темпо.",
    mode: "mafia_sport",
    rolePreset: "sport",
  },
];

export function QuickCreateSurface({
  state,
  dispatch,
  onOpenDetails,
  onSubmit,
  transition,
}: {
  state: LobbyFormState;
  dispatch: Dispatch<LobbyFormAction>;
  onOpenDetails: (trigger: HTMLButtonElement) => void;
  onSubmit: () => void;
  transition: (update: () => void) => void;
}) {
  const config = currentConfig(state);
  const players = boundedPlayerCount(state);
  const range = playerRange(state.mode);
  const experiences = state.family === "werewolves" ? WEREWOLF_EXPERIENCES : MAFIA_EXPERIENCES;
  const warnings = criticalRoleWarnings(state);
  const canCreate = warnings.length === 0;
  const roles = recommendedRoles(config.roles);
  const context = contextFor(state);
  const heading = state.family === "werewolves" ? "Стая за Върколак" : "Стая за Мафия";
  const primaryLabel = state.family === "werewolves" ? "Създай селото" : "Отвори масата";

  function selectExperience(experience: Experience) {
    transition(() => {
      dispatch({
        type: "APPLY_TEMPLATE",
        template: {
          mode: experience.mode,
          playerCount: Math.max(playerRange(experience.mode).min, Math.min(players, playerRange(experience.mode).max)),
          rolePreset: experience.rolePreset,
          tempoProfile: experience.mode === "mafia_sport" ? "sport_mafia" : normalizedTempo(state),
          communicationMode: state.communicationMode,
          narratorMode: state.narratorMode,
          ...(experience.advanced ? { advanced: experience.advanced } : {}),
        },
      });
    });
  }

  function selectContext(next: "online" | "live") {
    transition(() => {
      dispatch({
        type: "SET_TEMPO_PROFILE",
        tempoProfile: next === "live" ? "live" : state.mode === "mafia_sport" ? "sport_mafia" : "normal_online",
      });
      dispatch({
        type: "SET_COMMUNICATION_MODE",
        communicationMode: next === "live" ? "no_chat" : "built_in_chat",
      });
    });
  }

  return (
    <section className="create-quick-surface" aria-labelledby="create-quick-title">
      <header className="create-quick-heading">
        <div>
          <p className="create-quick-kicker">
            {state.family === "werewolves" ? "домакин на селото" : "домакин на масата"}
          </p>
          <h1 id="create-quick-title">{heading}</h1>
          <p>{state.family === "werewolves" ? "Компанията е твоя. Тайните са на селото." : "Една маса. Всеки със своето алиби."}</p>
        </div>
        <button type="button" className="create-details-button" onClick={(event) => onOpenDetails(event.currentTarget)}>
          <Settings2 aria-hidden="true" />
          Настрой детайлите
        </button>
      </header>

      <div className="create-quick-layout">
        <div className="create-quick-controls">
          <div className="create-quick-row">
            <section className="create-count-panel" aria-labelledby="create-player-count-title">
              <div className="create-control-heading">
                <div>
                  <h2 id="create-player-count-title">Брой играчи</h2>
                </div>
                <strong>{players}</strong>
              </div>
              {state.mode === "mafia_sport" ? (
                <p className="create-fixed-count">
                  <Check aria-hidden="true" />
                  Точно 10 играчи
                </p>
              ) : (
                <div className="create-count-control">
                  <button
                    type="button"
                    aria-label="Намали броя играчи"
                    disabled={players <= range.min}
                    onClick={() => dispatch({ type: "SET_PLAYER_COUNT", playerCount: players - 1 })}
                  >
                    <Minus aria-hidden="true" />
                  </button>
                  <input
                    type="range"
                    aria-label="Брой играчи"
                    min={range.min}
                    max={range.max}
                    value={players}
                    onChange={(event) =>
                      dispatch({ type: "SET_PLAYER_COUNT", playerCount: Number(event.target.value) })
                    }
                  />
                  <button
                    type="button"
                    aria-label="Увеличи броя играчи"
                    disabled={players >= range.max}
                    onClick={() => dispatch({ type: "SET_PLAYER_COUNT", playerCount: players + 1 })}
                  >
                    <Plus aria-hidden="true" />
                  </button>
                </div>
              )}
            </section>

            <section className="create-context-panel" aria-labelledby="create-context-title">
              <h2 id="create-context-title">Къде играете?</h2>
              <div className="create-segmented-control" role="group" aria-labelledby="create-context-title">
                <button
                  type="button"
                  aria-pressed={context === "online"}
                  data-active={context === "online" ? "true" : "false"}
                  onClick={() => selectContext("online")}
                >
                  <Monitor aria-hidden="true" />
                  Онлайн
                </button>
                <button
                  type="button"
                  aria-pressed={context === "live"}
                  data-active={context === "live" ? "true" : "false"}
                  onClick={() => selectContext("live")}
                >
                  <Users aria-hidden="true" />
                  На живо
                </button>
              </div>
            </section>
          </div>

          <fieldset className="create-choice-group">
            <legend>{state.family === "werewolves" ? "Каква да бъде вечерта?" : "Какъв е форматът?"}</legend>
            <div className="create-experience-grid" data-count={experiences.length}>
              {experiences.map((experience) => {
                const active = !state.manualRolesEnabled && (state.family === "werewolves"
                  ? state.rolePreset === experience.rolePreset : state.mode === experience.mode);
                return (
                  <button key={experience.id} type="button" className="create-experience-card"
                    data-active={active ? "true" : "false"} aria-pressed={active}
                    onClick={() => selectExperience(experience)}>
                    <span>{experience.eyebrow}</span>
                    <strong>{experience.title}</strong>
                    <small>{experience.detail}</small>
                    <i aria-hidden="true"><Check /></i>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <section className="create-recommendation" aria-labelledby="create-roster-title">
            <div className="create-recommendation-heading">
              <div>
                <span>{state.manualRolesEnabled ? "твоят състав" : "препоръчан състав"}</span>
                <h2 id="create-roster-title">{recommendationTitle(state)}</h2>
              </div>
              <span className="create-roster-capacity">{players} места</span>
            </div>
            <div className="create-role-portraits" aria-label="Всички роли в състава">
              {roles.map(([role, count]) => (
                <span className="create-role-portrait" key={role}>
                  <i aria-hidden="true" style={roleThumbStyle(state.family, role)} />
                  <b>{ROLE_DEFINITIONS[role].nameBg}</b>
                  <small>×{count}</small>
                </span>
              ))}
            </div>
            <p>{recommendationReason(state)}</p>
          </section>
        </div>

        <aside className="create-receipt" aria-label="Обобщение на стаята">
          <div className="create-receipt-heading">
            <span>тази вечер</span>
            <strong>{state.roomName}</strong>
          </div>
          <span className="create-ready-mark" data-ready={canCreate ? "true" : "false"}>
            <Check aria-hidden="true" />
            {canCreate ? "Готови за игра" : "Провери състава"}
          </span>
          <dl>
            <div>
              <dt>
                <Clock3 aria-hidden="true" />
                Време
              </dt>
              <dd>
                <strong>{formatEstimatedDuration(estimatedDurationSeconds(state))}</strong>
              </dd>
            </div>
            <div>
              <dt>
                <Monitor aria-hidden="true" />
                Комуникация
              </dt>
              <dd>
                <strong>{COMMUNICATION_LABELS[state.communicationMode]}</strong>
              </dd>
            </div>
          </dl>

          {warnings.length > 0 ? (
            <p className="create-receipt-warning" role="alert">
              {warnings[0]}
            </p>
          ) : null}

          <button type="button" className="create-primary-action" disabled={!canCreate} onClick={onSubmit}>
            {primaryLabel}
          </button>
          <small className="create-code-note">Кодът за покана се показва след създаването.</small>
        </aside>
      </div>

      <div className="create-mobile-action" aria-label="Бързо създаване">
        <span>
          <strong>{players}</strong>
          <small>{formatEstimatedDuration(estimatedDurationSeconds(state))}</small>
        </span>
        <button type="button" className="create-mobile-details" aria-label="Редактирай настройките" title="Настрой детайлите"
          onClick={(event) => onOpenDetails(event.currentTarget)}>
          <Settings2 aria-hidden="true" />
        </button>
        <button type="button" disabled={!canCreate} onClick={onSubmit}>
          {primaryLabel}
        </button>
      </div>
    </section>
  );
}

function normalizedTempo(state: LobbyFormState) {
  return state.tempoProfile === "sport_mafia" ? "normal_online" : state.tempoProfile;
}

function contextFor(state: LobbyFormState): "online" | "live" | "custom" {
  if (state.communicationMode === "no_chat") {
    return "live";
  }
  if (state.communicationMode === "built_in_chat") {
    return "online";
  }
  return "custom";
}

function recommendedRoles(roles: RoleDistribution) {
  const entries = Object.entries(roles).filter((entry): entry is [RoleCode, number] => Boolean(entry[1]));
  return entries.sort(([first], [second]) => rolePriority(first) - rolePriority(second));
}

function rolePriority(role: RoleCode) {
  if (role === "civilian" || role === "ordinary_villager") {
    return 4;
  }
  if (role === "werewolf" || role === "mafioso") {
    return 0;
  }
  return 1;
}

function recommendationTitle(state: LobbyFormState) {
  if (state.manualRolesEnabled) {
    return "Твоят състав";
  }
  if (state.mode === "mafia_sport") {
    return "Официалната десетка";
  }
  if (state.family === "mafia") {
    return "Алибита с достатъчно напрежение";
  }
  if (state.rolePreset === "beginner") {
    return "Чиста първа история";
  }
  if (state.rolePreset === "advanced") {
    return "Село с повече тайни";
  }
  return "Класически баланс";
}

function recommendationReason(state: LobbyFormState) {
  if (state.manualRolesEnabled) {
    return "Ръчният състав остава точен при промяна на броя играчи.";
  }
  if (state.mode === "mafia_sport") {
    return "Съставът и темпото следват спортния формат, затова не се нуждаят от ръчно балансиране.";
  }
  if (state.family === "mafia") {
    return "Има достатъчно информация за разследване и достатъчно място за убедително алиби.";
  }
  if (state.rolePreset === "beginner") {
    return "Всеки има ясна задача, а нощта остава лесна за проследяване.";
  }
  if (state.rolePreset === "advanced") {
    return "Специалните роли създават обрати, без да изместват разговора от центъра.";
  }
  return "Разследване, защита и Купидон дават напрежение без излишна сложност.";
}
