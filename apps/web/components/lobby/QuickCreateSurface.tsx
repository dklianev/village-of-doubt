import {
  Check,
  Clock3,
  Minus,
  Monitor,
  Plus,
  Settings2,
  Sparkles,
  Users,
} from "lucide-react";
import {
  ROLE_DEFINITIONS,
  type CommunicationMode,
  type RoleCode,
  type RoleDistribution,
  type RolePreset,
} from "@werewolf/shared";
import type { Dispatch, RefObject } from "react";
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
  playerCount: number;
  rolePreset: RolePreset;
  mode: LobbyFormState["mode"];
  advanced?: LobbyTemplate["advanced"];
};

const COMMUNICATION_LABELS: Record<CommunicationMode, string> = {
  built_in_chat: "Вграден чат",
  no_chat: "Без чат",
  system_only: "Само системни",
  secret_channels: "Тайни канали",
};

const WEREWOLF_EXPERIENCES: Experience[] = [
  {
    id: "first-night",
    eyebrow: "за нова група",
    title: "Първа нощ",
    detail: "Ясни роли и по-кратка вечер за 6-8 души.",
    mode: "werewolves_classic",
    playerCount: 6,
    rolePreset: "beginner",
  },
  {
    id: "classic-village",
    eyebrow: "препоръчано",
    title: "Класическо село",
    detail: "Баланс между разследване, защита и тайна любов.",
    mode: "werewolves_classic",
    playerCount: 12,
    rolePreset: "classic",
  },
  {
    id: "village-secrets",
    eyebrow: "за опитна маса",
    title: "Село с тайни",
    detail: "Повече специални роли и напрежение за 14+ души.",
    mode: "werewolves_classic",
    playerCount: 14,
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
    playerCount: 10,
    rolePreset: "free",
  },
  {
    id: "sport-table",
    eyebrow: "официален състав",
    title: "Спортна маса",
    detail: "Точно 10 играчи, фиксирани роли и състезателно темпо.",
    mode: "mafia_sport",
    playerCount: 10,
    rolePreset: "sport",
  },
];

export function QuickCreateSurface({
  state,
  dispatch,
  onOpenDetails,
  onSubmit,
  detailsButtonRef,
  transition,
}: {
  state: LobbyFormState;
  dispatch: Dispatch<LobbyFormAction>;
  onOpenDetails: () => void;
  onSubmit: () => void;
  detailsButtonRef?: RefObject<HTMLButtonElement | null>;
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
  const heading =
    state.family === "werewolves" ? "Подготви селото за една минута" : "Отвори частна маса за една минута";
  const primaryLabel = state.family === "werewolves" ? "Създай селото" : "Отвори масата";

  function selectExperience(experience: Experience) {
    transition(() => {
      dispatch({
        type: "APPLY_TEMPLATE",
        template: {
          mode: experience.mode,
          playerCount: experience.playerCount,
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
          <p>
            {state.family === "werewolves"
              ? "Избери каква вечер искаш. Съставът се балансира автоматично."
              : "Избери формат. Досиетата и ритъмът ще бъдат готови преди първото обвинение."}
          </p>
        </div>
        <span className="create-ready-mark" data-ready={canCreate ? "true" : "false"}>
          <Check aria-hidden="true" />
          {canCreate ? "готово за покана" : "провери състава"}
        </span>
      </header>

      <div className="create-quick-layout">
        <div className="create-quick-controls">
          <fieldset className="create-choice-group">
            <legend>{state.family === "werewolves" ? "Каква да бъде вечерта?" : "Какъв е форматът?"}</legend>
            <div className="create-experience-grid" data-count={experiences.length}>
              {experiences.map((experience) => {
                const active =
                  state.family === "werewolves"
                    ? state.rolePreset === experience.rolePreset
                    : state.mode === experience.mode;
                return (
                  <button
                    key={experience.id}
                    type="button"
                    className="create-experience-card"
                    data-active={active ? "true" : "false"}
                    aria-pressed={active}
                    onClick={() => selectExperience(experience)}
                  >
                    <span>{experience.eyebrow}</span>
                    <strong>{experience.title}</strong>
                    <small>{experience.detail}</small>
                    <i aria-hidden="true">
                      <Check />
                    </i>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="create-quick-row">
            <section className="create-count-panel" aria-labelledby="create-player-count-title">
              <div className="create-control-heading">
                <div>
                  <span>групата</span>
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

            <fieldset className="create-context-panel">
              <legend>Къде играете?</legend>
              <div className="create-segmented-control">
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
            </fieldset>
          </div>

          <section className="create-recommendation" aria-labelledby="create-roster-title">
            <div className="create-recommendation-heading">
              <div>
                <span>препоръчан състав</span>
                <h2 id="create-roster-title">{recommendationTitle(state)}</h2>
              </div>
              <Sparkles aria-hidden="true" />
            </div>
            <div className="create-role-portraits" aria-label="Основни роли в състава">
              {roles.map(([role, count]) => (
                <span className="create-role-portrait" key={role}>
                  <i aria-hidden="true" style={roleThumbStyle(state.family, role)} />
                  <b>{ROLE_DEFINITIONS[role].nameBg}</b>
                  {count > 1 ? <small>×{count}</small> : null}
                </span>
              ))}
            </div>
            <p>{recommendationReason(state)}</p>
          </section>
        </div>

        <aside className="create-receipt" aria-label="Обобщение на стаята">
          <div className="create-receipt-heading">
            <span>{state.family === "werewolves" ? "печат на селото" : "резервация на масата"}</span>
            <strong>{state.family === "werewolves" ? "Вечерта е подредена" : "Досиетата са подредени"}</strong>
          </div>
          <dl>
            <div>
              <dt>
                <Users aria-hidden="true" />
                Група
              </dt>
              <dd>
                <strong>{players} играчи</strong>
                <span>{state.mode === "mafia_sport" ? "фиксиран състав" : "автоматичен баланс"}</span>
              </dd>
            </div>
            <div>
              <dt>
                <Clock3 aria-hidden="true" />
                Време
              </dt>
              <dd>
                <strong>{formatEstimatedDuration(estimatedDurationSeconds(state))}</strong>
                <span>{state.tempoProfile === "live" ? "ритъм за маса на живо" : "водено онлайн"}</span>
              </dd>
            </div>
            <div>
              <dt>
                <Monitor aria-hidden="true" />
                Комуникация
              </dt>
              <dd>
                <strong>{COMMUNICATION_LABELS[state.communicationMode]}</strong>
                <span>{context === "live" ? "разговор около масата" : "вътре в стаята"}</span>
              </dd>
            </div>
          </dl>

          {warnings.length > 0 ? (
            <p className="create-receipt-warning" role="alert">
              {warnings[0]}
            </p>
          ) : null}

          <button
            ref={detailsButtonRef}
            type="button"
            className="create-details-button"
            onClick={onOpenDetails}
          >
            <Settings2 aria-hidden="true" />
            Настрой детайлите
          </button>
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
  return entries
    .sort(([first], [second]) => rolePriority(first) - rolePriority(second))
    .slice(0, 5);
}

function rolePriority(role: RoleCode) {
  if (role === "civilian") {
    return 4;
  }
  if (role === "werewolf" || role === "mafioso") {
    return 3;
  }
  return 1;
}

function recommendationTitle(state: LobbyFormState) {
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
