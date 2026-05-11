"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ROLE_DEFINITIONS,
  countRoles,
  createGameConfigFromOptions,
  GAME_MODE_DEFINITIONS,
  ROLE_PRESET_LABELS_BG,
  NARRATOR_VOICE_LABELS_BG,
  getGameFamily,
  getGameModeNameBg,
  getRoleBalanceScore,
  type CommunicationMode,
  type GameFamily,
  type GameMode,
  type MajorityMode,
  type NarratorMode,
  type NarratorVoice,
  type CommissionerResultMode,
  type RoleDistribution,
  type RolePreset,
  type TempoProfile,
  validateRoleDistributionForMode,
} from "@werewolf/shared";
import { ManualRoleBuilder } from "@/components/manual-role-builder";
import {
  ANONYMOUS_DISPLAY_NAME_KEY,
  saveAnonymousIdentity,
  validateDisplayNameBg,
} from "@/lib/anonymous-player";
import { stringifyRolesParam } from "@/lib/room-options";
import { roleThumbStyle } from "@/lib/role-art";

const COMMUNICATION_LABELS: Record<CommunicationMode, string> = {
  built_in_chat: "С вграден чат",
  no_chat: "Без чат (външен разговор/на живо)",
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

const MAJORITY_LABELS: Record<MajorityMode, string> = {
  simple: "Обикновено мнозинство",
  absolute: "Абсолютно мнозинство",
};

const COMMISSIONER_RESULT_LABELS: Record<CommissionerResultMode, string> = {
  team_only: "Само отбор",
  exact_role: "Точна роля",
};

const MANUAL_PRESET_STORAGE_KEY = "werewolf-mafia-manual-role-preset-v1";

export function LobbyCreateClient({
  initialMode = "werewolves_classic",
  family: lockedFamily,
}: {
  initialMode?: GameMode;
  family?: GameFamily;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [formError, setFormError] = useState("");
  const [manualPresetMessage, setManualPresetMessage] = useState("");
  const [code, setCode] = useState(createRoomCode);
  const [roomName, setRoomName] = useState(defaultRoomName(initialMode));
  const [mode, setMode] = useState<GameMode>(initialMode);
  const [playerCount, setPlayerCount] = useState(defaultPlayerCount(initialMode));
  const [maxPlayers, setMaxPlayers] = useState(defaultPlayerCount(initialMode));
  const [rolePreset, setRolePreset] = useState<RolePreset>(defaultRolePreset(initialMode));
  const [communicationMode, setCommunicationMode] = useState<CommunicationMode>("built_in_chat");
  const [narratorMode, setNarratorMode] = useState<NarratorMode>("automatic");
  const [narratorVoice, setNarratorVoice] = useState<NarratorVoice>("classic");
  const [tempoProfile, setTempoProfile] = useState<TempoProfile>("normal_online");
  const [loversEnabled, setLoversEnabled] = useState(false);
  const [revealRolesOnDeath, setRevealRolesOnDeath] = useState(true);
  const [allowSkipVote, setAllowSkipVote] = useState(true);
  const [majorityMode, setMajorityMode] = useState<MajorityMode>("simple");
  const [autoStart, setAutoStart] = useState(false);
  const [mafiaNightKill, setMafiaNightKill] = useState(true);
  const [doctorCanSelfProtect, setDoctorCanSelfProtect] = useState(false);
  const [commissionerResultMode, setCommissionerResultMode] = useState<CommissionerResultMode>("team_only");
  const [maniacEnabled, setManiacEnabled] = useState(false);
  const [jesterEnabled, setJesterEnabled] = useState(false);
  const [manualRolesEnabled, setManualRolesEnabled] = useState(false);
  const [manualRoles, setManualRoles] = useState<RoleDistribution>(() =>
    createGameConfigFromOptions({
      mode: initialMode,
      playerCount: defaultPlayerCount(initialMode),
      rolePreset: defaultRolePreset(initialMode),
    }).roles,
  );

  const boundedPlayerCount = clampPlayerCount(mode, playerCount);
  const family = lockedFamily ?? getGameFamily(mode);
  const presetConfig = createGameConfigFromOptions({
    mode,
    roomName,
    playerCount: boundedPlayerCount,
    maxPlayers,
    rolePreset,
    communicationMode,
    narratorMode,
    narratorVoice,
    tempoProfile,
    loversEnabled,
    revealRolesOnDeath,
    allowSkipVote,
    majorityMode,
    autoStart,
    mafiaNightKill,
    doctorCanSelfProtect,
    commissionerResultMode,
    maniacEnabled,
    jesterEnabled,
  });
  const config = manualRolesEnabled
    ? createGameConfigFromOptions({
        mode,
        roomName,
        playerCount: boundedPlayerCount,
        maxPlayers,
        communicationMode,
        narratorMode,
        narratorVoice,
        tempoProfile,
        loversEnabled,
        revealRolesOnDeath,
        allowSkipVote,
        majorityMode,
        autoStart,
        mafiaNightKill,
        doctorCanSelfProtect,
        commissionerResultMode,
        maniacEnabled,
        jesterEnabled,
        roles: manualRoles,
      })
    : presetConfig;
  const warnings = validateRoleDistributionForMode(mode, config.playerCount, config.roles);
  const roleTotal = countRoles(config.roles);
  const balanceScore = getRoleBalanceScore(config.roles);
  const roleQueryOption = manualRolesEnabled ? { roles: config.roles } : {};
  const playHref = buildRoomHref("/play", code, {
    mode,
    roomName,
    playerCount: boundedPlayerCount,
    maxPlayers: Math.max(maxPlayers, boundedPlayerCount),
    communicationMode,
    narratorMode,
    tempoProfile,
    loversEnabled,
    rolePreset,
    revealRolesOnDeath,
    allowSkipVote,
    majorityMode,
    autoStart,
    mafiaNightKill,
    doctorCanSelfProtect,
    commissionerResultMode,
    maniacEnabled,
    jesterEnabled,
    narratorVoice,
    ...roleQueryOption,
  });
  const lobbyHref = buildRoomHref("/lobby", code, {
    mode,
    roomName,
    playerCount: boundedPlayerCount,
    maxPlayers: Math.max(maxPlayers, boundedPlayerCount),
    communicationMode,
    narratorMode,
    tempoProfile,
    loversEnabled,
    rolePreset,
    revealRolesOnDeath,
    allowSkipVote,
    majorityMode,
    autoStart,
    mafiaNightKill,
    doctorCanSelfProtect,
    commissionerResultMode,
    maniacEnabled,
    jesterEnabled,
    narratorVoice,
    ...roleQueryOption,
  });

  useEffect(() => {
    setDisplayName(window.localStorage.getItem(ANONYMOUS_DISPLAY_NAME_KEY) ?? "");
  }, []);

  function changeMode(nextMode: GameMode) {
    setMode(nextMode);
    setPlayerCount(defaultPlayerCount(nextMode));
    setMaxPlayers(defaultPlayerCount(nextMode));
    setRoomName(defaultRoomName(nextMode));
    setRolePreset(defaultRolePreset(nextMode));
    setTempoProfile(nextMode === "mafia_sport" ? "sport_mafia" : "normal_online");
    setLoversEnabled(false);
    setManiacEnabled(false);
    setJesterEnabled(false);
    setManualRolesEnabled(false);
    setManualRoles(
      createGameConfigFromOptions({
        mode: nextMode,
        playerCount: defaultPlayerCount(nextMode),
        rolePreset: defaultRolePreset(nextMode),
      }).roles,
    );
  }

  function changeRolePreset(nextPreset: RolePreset) {
    setRolePreset(nextPreset);
    setManualRolesEnabled(nextPreset === "manual");
    setManualRoles(createGameConfigFromOptions({ mode, playerCount: boundedPlayerCount, rolePreset: nextPreset }).roles);
  }

  function enableManualRoles(enabled: boolean) {
    setManualRolesEnabled(enabled);
    if (enabled) {
      setManualRoles(presetConfig.roles);
    }
  }

  function saveManualPreset() {
    window.localStorage.setItem(
      `${MANUAL_PRESET_STORAGE_KEY}:${family}`,
      JSON.stringify({
        mode,
        playerCount: boundedPlayerCount,
        roles: manualRoles,
        savedAt: Date.now(),
      }),
    );
    setManualPresetMessage("Шаблонът е запазен на това устройство.");
  }

  function loadManualPreset() {
    const raw = window.localStorage.getItem(`${MANUAL_PRESET_STORAGE_KEY}:${family}`);
    if (!raw) {
      setManualPresetMessage("Няма запазен шаблон за тази игра.");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { mode?: GameMode; playerCount?: number; roles?: RoleDistribution };
      const savedMode = isGameMode(parsed.mode) && getGameFamily(parsed.mode) === family ? parsed.mode : undefined;
      if (savedMode) {
        setMode(savedMode);
      }
      if (parsed.playerCount) {
        setPlayerCount(parsed.playerCount);
        setMaxPlayers(Math.max(parsed.playerCount, maxPlayers));
      }
      const normalized = createGameConfigFromOptions({
        mode: savedMode ?? mode,
        playerCount: parsed.playerCount ?? boundedPlayerCount,
        roles: parsed.roles ?? {},
      });
      setManualRoles(normalized.roles);
      setManualRolesEnabled(true);
      setManualPresetMessage("Шаблонът е зареден.");
    } catch {
      setManualPresetMessage("Запазеният шаблон не може да бъде прочетен.");
    }
  }

  function enterRoom(href: string) {
    const error = validateDisplayNameBg(displayName);
    if (error) {
      setFormError(error);
      return;
    }

    saveAnonymousIdentity(displayName);
    setFormError("");
    router.push(href);
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
            <span className="text-xs uppercase tracking-[0.25em] text-[#c18a38]">Потребителско име</span>
            <input
              className="input"
              value={displayName}
              maxLength={24}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Например: Мила"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.25em] text-[#c18a38]">Име на стаята</span>
            <input className="input" value={roomName} onChange={(event) => setRoomName(event.target.value)} maxLength={42} />
          </label>

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
              {availableModes(family).map((value) => (
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
            <span className="text-xs uppercase tracking-[0.25em] text-[#c18a38]">Максимум играчи</span>
            <input
              className="input"
              type="number"
              min={boundedPlayerCount}
              max={playerRange(mode).max}
              value={Math.max(maxPlayers, boundedPlayerCount)}
              onChange={(event) => setMaxPlayers(Number(event.target.value))}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.25em] text-[#c18a38]">Preset на ролите</span>
            <select className="input" value={manualRolesEnabled ? "manual" : rolePreset} onChange={(event) => changeRolePreset(event.target.value as RolePreset)}>
              {rolePresetsForMode(mode).map((preset) => (
                <option key={preset} value={preset}>
                  {ROLE_PRESET_LABELS_BG[preset]}
                </option>
              ))}
            </select>
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
            <span className="text-xs uppercase tracking-[0.25em] text-[#c18a38]">Глас на Разказвача</span>
            <select className="input" value={narratorVoice} onChange={(event) => setNarratorVoice(event.target.value as NarratorVoice)}>
              {Object.entries(NARRATOR_VOICE_LABELS_BG).map(([value, label]) => (
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
          <section className="mt-6 grid gap-3 rounded-2xl border border-[#f4e8d1]/15 bg-[#f4e8d1]/10 p-4">
            <h2 className="text-xl font-black">Настройки за Върколак</h2>
            <Toggle checked={loversEnabled} onChange={setLoversEnabled} label="Включи Купидон и Влюбени, когато разпределението го позволява." />
          </section>
        ) : null}

        {family === "mafia" ? (
          <section className="mt-6 grid gap-3 rounded-2xl border border-[#f4e8d1]/15 bg-[#f4e8d1]/10 p-4">
            <h2 className="text-xl font-black">Настройки за Мафия</h2>
            <Toggle checked={mafiaNightKill} onChange={setMafiaNightKill} label="Нощно убийство от Мафията." />
            <Toggle checked={doctorCanSelfProtect} onChange={setDoctorCanSelfProtect} label="Докторът може да пази себе си." />
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.25em] text-[#c18a38]">Резултат от Комисаря</span>
              <select
                className="input"
                value={commissionerResultMode}
                onChange={(event) => setCommissionerResultMode(event.target.value as CommissionerResultMode)}
              >
                {Object.entries(COMMISSIONER_RESULT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Toggle checked={maniacEnabled} onChange={setManiacEnabled} label="Добави Маниак като трета страна, когато preset-ът го позволява." />
            <Toggle checked={jesterEnabled} onChange={setJesterEnabled} label="Добави Шут с лична победа при дневно елиминиране." />
          </section>
        ) : null}

        <section className="mt-6 grid gap-3 rounded-2xl border border-[#f4e8d1]/15 bg-[#f4e8d1]/10 p-4">
          <h2 className="text-xl font-black">Правила и таймери</h2>
          <Toggle checked={revealRolesOnDeath} onChange={setRevealRolesOnDeath} label="Разкриване на ролята при смърт." />
          <Toggle checked={allowSkipVote} onChange={setAllowSkipVote} label="Позволи пропускане на глас." />
          <Toggle checked={autoStart} onChange={setAutoStart} label="Автоматичен старт, когато всички са готови." />
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.25em] text-[#c18a38]">Изискване за гласуване</span>
            <select className="input" value={majorityMode} onChange={(event) => setMajorityMode(event.target.value as MajorityMode)}>
              {Object.entries(MAJORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="text-sm font-bold text-[#ead9ba]">
              Обикновено мнозинство за по-бърза игра или Абсолютно мнозинство за по-строга маса.
            </span>
          </label>
          <p className="text-sm font-bold text-[#ead9ba]">
            Темпото управлява таймерите за ден, нощ и гласуване. Видимите настройки тук са свързани със сървъра и се записват в поканата.
          </p>
        </section>

        {narratorMode === "full_human" ? (
          <div className="mt-6 rounded-2xl bg-[#842f2b]/25 p-4 font-bold text-[#fff6e5]">
            Пълен Разказвач вижда всички роли и действия. Играчите ще трябва да го приемат съзнателно преди старт.
          </div>
        ) : null}

        <section data-testid="manual-roles-panel" className="mt-6 rounded-[2rem] border border-[#f4e8d1]/15 bg-[#f4e8d1]/8 p-5">
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
            <ManualRoleBuilder
              family={family}
              playerCount={boundedPlayerCount}
              roles={manualRoles}
              warnings={warnings}
              onRolesChange={setManualRoles}
              onSavePreset={saveManualPreset}
              onLoadPreset={loadManualPreset}
              presetMessage={manualPresetMessage}
            />
          ) : null}
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" className="btn btn-secondary" onClick={() => enterRoom(lobbyHref)}>
            Прегледай лоби
          </button>
          <button type="button" className="btn btn-primary" onClick={() => enterRoom(playHref)}>
            Създай и влез
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void copyInvite(lobbyHref, setFormError)}>
            Копирай код
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void shareInvite(lobbyHref, roomName, setFormError)}>
            Сподели покана
          </button>
        </div>
        {formError ? <p className="mt-4 rounded-2xl bg-[#842f2b]/20 p-4 font-bold text-[#fff6e5]">{formError}</p> : null}
      </div>

      <aside className="paper-card lobby-preset-card rounded-[2rem] p-7">
        <p className="text-sm uppercase tracking-[0.3em] text-[#842f2b]">разпределение</p>
        <h2 className="mt-3 text-3xl font-black">
          {config.playerCount} играчи · {getGameModeNameBg(mode)}
        </h2>
        <p className="mt-2 font-bold text-[#842f2b]">
          Роли: {roleTotal}/{config.playerCount} · {manualRolesEnabled ? "ръчна конфигурация" : "готово разпределение"}
        </p>
        {family === "werewolves" ? (
          <p className="mt-2 font-bold text-[#842f2b]">Баланс на ролите: {balanceScore > 0 ? `+${balanceScore}` : balanceScore}</p>
        ) : null}
        <div className={`mode-preview-strip mode-${mode}`} aria-hidden="true">
          <span>{getGameModeNameBg(mode)}</span>
        </div>
        <dl className="mt-6 grid gap-3">
          {Object.entries(config.roles).map(([role, count]) => (
            <div key={role} className={`role-count-chip role-${role}`}>
              <dt>
                <span className="role-count-art" aria-hidden="true" style={roleThumbStyle(family, role as keyof typeof ROLE_DEFINITIONS)} />
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
          <Summary label="Нощна фаза" value={`${config.timers.factionNightActionSeconds} сек.`} />
          <Summary label="Гласуване" value={`${config.timers.voteSeconds} сек.`} />
        </div>

        {warnings.length > 0 ? (
          <div className="mt-5 rounded-2xl bg-[#842f2b]/10 p-4 text-sm font-bold text-[#842f2b]">
            {warnings.join(" ")}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl bg-emerald-900/10 p-4 text-sm font-bold text-emerald-900">
            Тази комбинация от роли е валидна.
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
    roomName: string;
    playerCount: number;
    maxPlayers: number;
    communicationMode: CommunicationMode;
    narratorMode: NarratorMode;
    tempoProfile: TempoProfile;
    loversEnabled: boolean;
    rolePreset: RolePreset;
    revealRolesOnDeath: boolean;
    allowSkipVote: boolean;
    majorityMode: MajorityMode;
    autoStart: boolean;
    mafiaNightKill: boolean;
    doctorCanSelfProtect: boolean;
    commissionerResultMode: CommissionerResultMode;
    maniacEnabled: boolean;
    jesterEnabled: boolean;
    narratorVoice: NarratorVoice;
    roles?: RoleDistribution;
  },
) {
  const params = new URLSearchParams({
    mode: options.mode,
    roomName: options.roomName,
    players: String(options.playerCount),
    maxPlayers: String(options.maxPlayers),
    communication: options.communicationMode,
    narrator: options.narratorMode,
    tempo: options.tempoProfile,
    preset: options.rolePreset,
    reveal: options.revealRolesOnDeath ? "1" : "0",
    skip: options.allowSkipVote ? "1" : "0",
    majority: options.majorityMode,
    autoStart: options.autoStart ? "1" : "0",
    mafiaKill: options.mafiaNightKill ? "1" : "0",
    doctorSelf: options.doctorCanSelfProtect ? "1" : "0",
    commissionerResult: options.commissionerResultMode,
    narratorVoice: options.narratorVoice,
  });

  if (options.loversEnabled) {
    params.set("lovers", "1");
  }
  if (options.roles) {
    params.set("roles", stringifyRolesParam(options.roles));
  }
  if (options.maniacEnabled) {
    params.set("maniac", "1");
  }
  if (options.jesterEnabled) {
    params.set("jester", "1");
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

function defaultRolePreset(mode: GameMode): RolePreset {
  return mode === "mafia_sport" ? "sport" : mode === "mafia_free" ? "free" : "classic";
}

function defaultRoomName(mode: GameMode) {
  return getGameFamily(mode) === "mafia" ? "Частна маса" : "Частно село";
}

function availableModes(family: GameFamily): GameMode[] {
  return (Object.keys(GAME_MODE_DEFINITIONS) as GameMode[]).filter((mode) => getGameFamily(mode) === family);
}

function isGameMode(value: unknown): value is GameMode {
  return typeof value === "string" && value in GAME_MODE_DEFINITIONS;
}

function rolePresetsForMode(mode: GameMode): RolePreset[] {
  if (mode === "mafia_sport") {
    return ["sport", "manual"];
  }
  if (mode === "mafia_free") {
    return ["free", "manual"];
  }
  return ["beginner", "classic", "advanced", "manual"];
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

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl bg-[#f4e8d1]/10 p-3">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="font-bold">{label}</span>
    </label>
  );
}

async function copyInvite(href: string, setMessage: (message: string) => void) {
  const url = new URL(href, window.location.origin).toString();
  await navigator.clipboard.writeText(url).catch(() => {});
  setMessage("Кодът на стаята е копиран.");
}

async function shareInvite(href: string, roomName: string, setMessage: (message: string) => void) {
  const url = new URL(href, window.location.origin).toString();
  if (navigator.share) {
    await navigator.share({ title: roomName || "Покана за игра", url }).catch(() => {});
    return;
  }

  await copyInvite(href, setMessage);
}
