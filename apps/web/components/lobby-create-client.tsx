"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ROLE_DEFINITIONS,
  countRoles,
  createGameConfigFromOptions,
  GAME_MODE_DEFINITIONS,
  getGameFamily,
  getGameModeNameBg,
  getRolesForFamily,
  validateRoleDistribution,
  type CommunicationMode,
  type GameMode,
  type NarratorMode,
  type RoleCode,
  type RoleDistribution,
  type TempoProfile,
} from "@werewolf/shared";
import { stringifyRolesParam } from "@/lib/room-options";

const COMMUNICATION_LABELS: Record<CommunicationMode, string> = {
  built_in_chat: "С вграден чат",
  no_chat: "Без чат (Discord/на живо)",
  system_only: "Само системни съобщения",
  secret_channels: "Само тайни канали",
};

const NARRATOR_LABELS: Record<NarratorMode, string> = {
  automatic: "Автоматичен Разказвач",
  honest_human: "Честен Разказвач",
  full_human: "Пълен Разказвач",
};

const TEMPO_LABELS: Record<TempoProfile, string> = {
  fast_online: "Бърза онлайн игра",
  normal_online: "Нормална онлайн игра",
  live: "Игра на живо",
  sport_mafia: "Спортна Мафия",
  manual: "Ръчно водене",
};

export function LobbyCreateClient({ initialMode = "werewolves_classic" }: { initialMode?: GameMode }) {
  const [code, setCode] = useState(createRoomCode);
  const [mode, setMode] = useState<GameMode>(initialMode);
  const [playerCount, setPlayerCount] = useState(defaultPlayerCount(initialMode));
  const [communicationMode, setCommunicationMode] = useState<CommunicationMode>("built_in_chat");
  const [narratorMode, setNarratorMode] = useState<NarratorMode>("automatic");
  const [tempoProfile, setTempoProfile] = useState<TempoProfile>("normal_online");
  const [loversEnabled, setLoversEnabled] = useState(false);
  const [manualRolesEnabled, setManualRolesEnabled] = useState(false);
  const [manualRoles, setManualRoles] = useState<RoleDistribution>(() =>
    createGameConfigFromOptions({ mode: initialMode, playerCount: defaultPlayerCount(initialMode) }).roles,
  );

  const boundedPlayerCount = clampPlayerCount(mode, playerCount);
  const family = getGameFamily(mode);
  const presetConfig = createGameConfigFromOptions({
    mode,
    playerCount: boundedPlayerCount,
    communicationMode,
    narratorMode,
    tempoProfile,
    loversEnabled,
  });
  const config = manualRolesEnabled
    ? createGameConfigFromOptions({
        mode,
        playerCount: boundedPlayerCount,
        communicationMode,
        narratorMode,
        tempoProfile,
        loversEnabled,
        roles: manualRoles,
      })
    : presetConfig;
  const warnings = validateRoleDistribution(config.playerCount, config.roles);
  const roleTotal = countRoles(config.roles);
  const roleQueryOption = manualRolesEnabled ? { roles: config.roles } : {};
  const playHref = buildRoomHref("/play", code, {
    mode,
    playerCount: boundedPlayerCount,
    communicationMode,
    narratorMode,
    tempoProfile,
    loversEnabled,
    ...roleQueryOption,
  });
  const lobbyHref = buildRoomHref("/lobby", code, {
    mode,
    playerCount: boundedPlayerCount,
    communicationMode,
    narratorMode,
    tempoProfile,
    loversEnabled,
    ...roleQueryOption,
  });

  function changeMode(nextMode: GameMode) {
    setMode(nextMode);
    setPlayerCount(defaultPlayerCount(nextMode));
    setTempoProfile(nextMode === "mafia_sport" ? "sport_mafia" : "normal_online");
    setLoversEnabled(false);
    setManualRolesEnabled(false);
    setManualRoles(createGameConfigFromOptions({ mode: nextMode, playerCount: defaultPlayerCount(nextMode) }).roles);
  }

  function enableManualRoles(enabled: boolean) {
    setManualRolesEnabled(enabled);
    if (enabled) {
      setManualRoles(presetConfig.roles);
    }
  }

  function updateManualRole(role: RoleCode, count: number) {
    setManualRoles((current) => ({
      ...current,
      [role]: Math.max(0, Math.floor(Number.isFinite(count) ? count : 0)),
    }));
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]" data-theme={family} data-family={family}>
      <div className="card rounded-[2rem] p-7">
        <p className="text-sm uppercase tracking-[0.3em] text-[#c18a38]">лоби</p>
        <h1 className="mt-3 text-5xl font-black">Създай частна стая</h1>
        <p className="mt-5 max-w-2xl text-[#ead9ba]">
          Настрой играта преди поканата: режим, брой играчи, Разказвач, чат и темпо. Всички
          настройки се виждат преди старт, тайните роли остават само на сървъра.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.25em] text-[#c18a38]">Код</span>
            <div className="flex gap-2">
              <input
                className="input w-full"
                value={code}
                onChange={(event) => setCode(cleanRoomCode(event.target.value))}
                maxLength={12}
              />
              <button className="btn btn-secondary" type="button" onClick={() => setCode(createRoomCode())}>
                Нов
              </button>
            </div>
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.25em] text-[#c18a38]">Режим</span>
            <select className="input" value={mode} onChange={(event) => changeMode(event.target.value as GameMode)}>
              {(Object.keys(GAME_MODE_DEFINITIONS) as GameMode[]).map((value) => (
                <option key={value} value={value}>
                  {getGameModeNameBg(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.25em] text-[#c18a38]">Брой играчи</span>
            <input
              className="input"
              type="number"
              min={playerRange(mode).min}
              max={playerRange(mode).max}
              value={boundedPlayerCount}
              disabled={mode === "mafia_sport"}
              onChange={(event) => setPlayerCount(Number(event.target.value))}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.25em] text-[#c18a38]">Комуникация</span>
            <select
              className="input"
              value={communicationMode}
              onChange={(event) => setCommunicationMode(event.target.value as CommunicationMode)}
            >
              {Object.entries(COMMUNICATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.25em] text-[#c18a38]">Разказвач</span>
            <select className="input" value={narratorMode} onChange={(event) => setNarratorMode(event.target.value as NarratorMode)}>
              {Object.entries(NARRATOR_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.25em] text-[#c18a38]">Темпо</span>
            <select className="input" value={tempoProfile} onChange={(event) => setTempoProfile(event.target.value as TempoProfile)}>
              {Object.entries(TEMPO_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {mode === "werewolves_classic" ? (
          <label className="mt-6 flex items-center gap-3 rounded-2xl border border-[#f4e8d1]/15 bg-[#f4e8d1]/10 p-4">
            <input
              type="checkbox"
              checked={loversEnabled}
              onChange={(event) => setLoversEnabled(event.target.checked)}
            />
            <span>
              Включи Купидон и Влюбени, когато готовото разпределение позволява. Добре е за по-големи групи.
            </span>
          </label>
        ) : null}

        {narratorMode === "full_human" ? (
          <div className="mt-6 rounded-2xl bg-[#842f2b]/25 p-4 font-bold text-[#fff6e5]">
            Пълен Разказвач вижда всички роли и действия. Играчите ще трябва да го приемат съзнателно преди старт.
          </div>
        ) : null}

        <section className="mt-6 rounded-[2rem] border border-[#f4e8d1]/15 bg-[#f4e8d1]/8 p-5">
          <label className="flex items-center justify-between gap-4">
            <span>
              <strong className="block text-lg">Ръчни роли</strong>
              <span className="text-sm text-[#ead9ba]">
                Използвай готовото разпределение като старт, после настрой ролите за твоята група.
              </span>
            </span>
            <input
              type="checkbox"
              checked={manualRolesEnabled}
              onChange={(event) => enableManualRoles(event.target.checked)}
            />
          </label>

          {manualRolesEnabled ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {getRolesForFamily(family).map((role) => (
                <label key={role} className="grid gap-2 rounded-2xl bg-[#f4e8d1]/10 p-4">
                  <span className="text-sm font-bold">{ROLE_DEFINITIONS[role].nameBg}</span>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-secondary min-h-0 px-3 py-2"
                      type="button"
                      onClick={() => updateManualRole(role, (manualRoles[role] ?? 0) - 1)}
                    >
                      -
                    </button>
                    <input
                      className="input w-full text-center"
                      type="number"
                      min={0}
                      max={47}
                      value={manualRoles[role] ?? 0}
                      onChange={(event) => updateManualRole(role, Number(event.target.value))}
                    />
                    <button
                      className="btn btn-secondary min-h-0 px-3 py-2"
                      type="button"
                      onClick={() => updateManualRole(role, (manualRoles[role] ?? 0) + 1)}
                    >
                      +
                    </button>
                  </div>
                </label>
              ))}
            </div>
          ) : null}
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={lobbyHref} className="btn btn-secondary">
            Прегледай лоби
          </Link>
          <Link href={playHref} className="btn btn-primary">
            Създай и влез
          </Link>
        </div>
      </div>

      <aside className="paper-card lobby-preset-card rounded-[2rem] p-7">
        <p className="text-sm uppercase tracking-[0.3em] text-[#842f2b]">разпределение</p>
        <h2 className="mt-3 text-3xl font-black">
          {config.playerCount} играчи · {getGameModeNameBg(mode)}
        </h2>
        <p className="mt-2 font-bold text-[#842f2b]">
          Роли: {roleTotal}/{config.playerCount} · {manualRolesEnabled ? "ръчна конфигурация" : "готово разпределение"}
        </p>
        <div className={`mode-preview-strip mode-${mode}`} aria-hidden="true">
          <span>{getGameModeNameBg(mode)}</span>
        </div>
        <dl className="mt-6 grid gap-3">
          {Object.entries(config.roles).map(([role, count]) => (
            <div key={role} className={`role-count-chip role-${role}`}>
              <dt>
                <span className="role-count-art" aria-hidden="true" />
                <span className="font-bold">{ROLE_DEFINITIONS[role as keyof typeof ROLE_DEFINITIONS].nameBg}</span>
              </dt>
              <dd>{count}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 grid gap-2 text-sm">
          <Summary label="Разказвач" value={NARRATOR_LABELS[narratorMode]} />
          <Summary label="Комуникация" value={COMMUNICATION_LABELS[communicationMode]} />
          <Summary label="Темпо" value={TEMPO_LABELS[tempoProfile]} />
          <Summary label="Дневно обсъждане" value={`${config.timers.dayDiscussionSeconds} сек.`} />
          <Summary label="Гласуване" value={`${config.timers.voteSeconds} сек.`} />
        </div>

        {warnings.length > 0 ? (
          <div className="mt-5 rounded-2xl bg-[#842f2b]/10 p-4 text-sm font-bold text-[#842f2b]">
            {warnings.join(" ")}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl bg-emerald-900/10 p-4 text-sm font-bold text-emerald-900">
            Preset-ът е валиден.
          </div>
        )}
        <div className="achievement-preview-strip mt-5" aria-hidden="true">
          <span>победи</span>
          <span>оцеляване</span>
          <span>блъф</span>
        </div>
      </aside>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 rounded-2xl bg-white/25 px-4 py-3">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildRoomHref(
  base: "/play" | "/lobby",
  code: string,
  options: {
    mode: GameMode;
    playerCount: number;
    communicationMode: CommunicationMode;
    narratorMode: NarratorMode;
    tempoProfile: TempoProfile;
    loversEnabled: boolean;
    roles?: RoleDistribution;
  },
) {
  const params = new URLSearchParams({
    mode: options.mode,
    players: String(options.playerCount),
    communication: options.communicationMode,
    narrator: options.narratorMode,
    tempo: options.tempoProfile,
  });

  if (options.loversEnabled) {
    params.set("lovers", "1");
  }
  if (options.roles) {
    params.set("roles", stringifyRolesParam(options.roles));
  }

  return `${base}/${cleanRoomCode(code)}?${params.toString()}`;
}

function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function cleanRoomCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

function defaultPlayerCount(mode: GameMode) {
  return mode === "mafia_sport" ? 10 : mode === "mafia_free" ? 10 : 10;
}

function playerRange(mode: GameMode) {
  if (mode === "mafia_sport") {
    return { min: 10, max: 10 };
  }
  if (mode === "mafia_free") {
    return { min: 4, max: 24 };
  }
  return { min: 6, max: 30 };
}

function clampPlayerCount(mode: GameMode, value: number) {
  const range = playerRange(mode);
  const safeValue = Number.isFinite(value) ? value : defaultPlayerCount(mode);
  return Math.min(range.max, Math.max(range.min, Math.round(safeValue)));
}
