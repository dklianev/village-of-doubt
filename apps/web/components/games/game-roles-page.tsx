"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import {
  ROLE_DEFINITIONS,
  getRoleAssetKey,
  getRoleRuntimeStatus,
  getRolesForFamily,
  teamLabelBg,
  type GameFamily,
  type RoleCode,
} from "@werewolf/shared";
import { ResourceHints } from "@/components/resource-hints";
import { roleArtPath, roleThumbPath } from "@/lib/role-art";

type RoleFilter = "all" | "starter" | "advanced" | "night" | "large";
type TeamFilter = "all" | "town" | "evil" | "vampires" | "lovers" | "neutral";

const KNOWN_WEREWOLF_ROLE_ASSETS = new Set([
  "ordinary-villager",
  "werewolf",
  "seer",
  "witch",
  "healer",
  "priest",
  "hunter",
  "cupid",
  "vampire",
  "red-riding-hood",
  "oracle",
  "cook",
  "blacksmith",
  "insomniac",
  "vampire-hunter",
  "investigator",
  "drunk",
  "stray-cat",
  "guard-dog",
  "little-girl",
  "thief",
  "mayor",
]);

const KNOWN_MAFIA_ROLE_ASSETS = new Set([
  "civilian",
  "commissioner",
  "don",
  "mafioso",
  "doctor",
  "detective",
  "bodyguard",
  "vigilante",
  "medium",
  "roleblocker",
  "lawyer",
  "informant",
  "maniac",
  "jester",
  "mayor",
  "lovers",
]);

export function GameRolesPage({ family }: { family: GameFamily }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [selectedRole, setSelectedRole] = useState<RoleCode | null>(null);
  const deferredQuery = useDeferredValue(query);
  const isMafia = family === "mafia";
  const title = isMafia ? "Роли в Мафия" : "Роли във Върколак";
  const intro = isMafia
    ? "Бърз справочник за града: кой разследва, кой пази и кой дърпа конците след полунощ."
    : "Бърз справочник за селото: кой вижда, кой лъже и кои роли обръщат нощта.";
  const allRoles = getRolesForFamily(family).sort(compareRoles);
  const roles = allRoles
    .filter((role) => matchesRoleFilter(role, filter))
    .filter((role) => matchesTeamFilter(role, teamFilter))
    .filter((role) => matchesRoleSearch(role, deferredQuery))
    .sort(compareRoles);

  useEffect(() => {
    if (!selectedRole) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedRole(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRole]);

  return (
    <main className="shell roles-shell" data-theme={family} data-family={family}>
      <ResourceHints images={allRoles.slice(0, 4).map((role) => roleThumbPath(family, role))} />
      <section className="role-codex-hero">
        <div className="role-codex-hero-copy">
          <p className="section-kicker">{isMafia ? "досиета на града" : "книга на персонажите"}</p>
          <h1>{title}</h1>
          <p>{intro}</p>
          <div className="role-codex-hero-actions">
            <Link className="btn btn-primary" href={isMafia ? "/mafia/create" : "/werewolf/create"}>
              Създай игра
            </Link>
            <Link className="role-family-link" href={isMafia ? "/werewolf/roles" : "/mafia/roles"}>
              {isMafia ? "Виж ролите във Върколак" : "Виж ролите в Мафия"}
            </Link>
          </div>
        </div>
        <div className="role-codex-hero-stat" aria-label="Брой роли">
          <strong>{allRoles.length}</strong>
          <span>{isMafia ? "градски досиета" : "селски роли"}</span>
        </div>
      </section>

      <section className="role-codex-toolbar" aria-label="Филтри за роли">
        <div className="role-search-wrap">
          <span aria-hidden="true">⌕</span>
          <input
            className="role-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={isMafia ? "Търси: лекар, дон, шут..." : "Търси: вампир, лечител, оракул..."}
            aria-label="Търси роля"
          />
        </div>
        <div className="role-filter-stack">
          <div className="role-filter-chips" aria-label="Тип роли">
            {roleFilterOptions.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? "is-active" : ""}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="role-filter-chips role-team-chips" aria-label="Отбори">
            {teamFilterOptions(family).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={teamFilter === value ? "is-active" : ""}
                onClick={() => setTeamFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="role-codex-result-line">
        <span>
          Показани {roles.length} от {allRoles.length} роли
        </span>
        {query.trim().length > 0 ? <span>Търсене: “{query.trim()}”</span> : null}
      </div>

      <div className="role-codex-grid">
        {roles.map((role, index) => {
          const definition = ROLE_DEFINITIONS[role];
          const runtimeStatus = getRoleRuntimeStatus(role);
          return (
            <article key={role} className={`role-codex-card role-codex-card-compact role-${role}`}>
              <button type="button" className="role-codex-card-button" onClick={() => setSelectedRole(role)}>
                <RoleArt role={role} family={family} priority={index < 4} />
                <div className="role-codex-copy">
                  <div className="role-codex-card-topline">
                    <span>{teamLabelBg(definition.team, family)}</span>
                    <span>{definition.nightAction ? "Нощна" : "Дневна"}</span>
                  </div>
                  <h2 className="role-card-title">{definition.nameBg}</h2>
                  <p>{definition.shortDescriptionBg}</p>
                  <div className="role-codex-tags" aria-label="Данни за ролята">
                    <span>{runtimeStatus === "playable" ? "Автоматична" : "Ръчно водене"}</span>
                    {definition.isDefaultEnabled ? <span>Стартова</span> : null}
                    <span>Стойност {formatValue(definition.value)}</span>
                    <span>{definition.nightOrder === null ? "Без нощен ред" : `Ред ${definition.nightOrder}`}</span>
                  </div>
                  <span className="role-codex-open">Отвори досието</span>
                </div>
              </button>
            </article>
          );
        })}
      </div>
      {roles.length === 0 ? (
        <section className="role-codex-empty">
          <h2 className="text-3xl font-black">Няма роля по този филтър</h2>
          <p className="mt-3 text-[#4f3829]">Пробвай с друго име или върни филтъра на “Всички”.</p>
        </section>
      ) : null}
      {selectedRole ? <RoleCodexDetail family={family} role={selectedRole} onClose={() => setSelectedRole(null)} /> : null}
    </main>
  );
}

function RoleArt({ role, family, priority }: { role: RoleCode; family: GameFamily; priority: boolean }) {
  const assetKey = getRoleAssetKey(role);
  const hasAsset =
    family === "mafia" ? KNOWN_MAFIA_ROLE_ASSETS.has(assetKey) : KNOWN_WEREWOLF_ROLE_ASSETS.has(assetKey);
  const src = hasAsset ? roleThumbPath(family, role) : "/game-art/thumbs/card-back-secret.webp";
  const fallbackSrc = hasAsset ? roleArtPath(family, role, "png") : "/game-art/card-back-secret.png";

  return (
    <picture className="role-codex-art role-codex-frame" aria-hidden="true">
      <img
        src={src}
        alt=""
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        width={520}
        height={728}
        onError={(event) => {
          if (event.currentTarget.src.endsWith(fallbackSrc)) {
            return;
          }
          event.currentTarget.src = fallbackSrc;
        }}
      />
    </picture>
  );
}

function RoleCodexDetail({ family, role, onClose }: { family: GameFamily; role: RoleCode; onClose: () => void }) {
  const definition = ROLE_DEFINITIONS[role];
  const runtimeStatus = getRoleRuntimeStatus(role);

  return (
    <div className="role-codex-detail" role="dialog" aria-modal="true" aria-labelledby="role-codex-detail-title">
      <button type="button" className="role-codex-detail-backdrop" aria-label="Затвори досието" onClick={onClose} />
      <article className="role-codex-detail-panel">
        <button type="button" className="role-codex-detail-close" aria-label="Затвори досието" onClick={onClose}>
          ×
        </button>
        <RoleArt role={role} family={family} priority />
        <div className="role-codex-detail-copy">
          <p className="section-kicker">{teamLabelBg(definition.team, family)}</p>
          <h2 id="role-codex-detail-title">{definition.nameBg}</h2>
          <blockquote className="role-table-quote">{roleQuoteBg(role, family)}</blockquote>
          <p>{definition.fullDescriptionBg}</p>
          <div className="role-table-advice">
            <span>{roleStrategyBg(role, family)}</span>
            <span>{roleCounterplayBg(role, family)}</span>
          </div>
          <div className="role-codex-tags">
            <span>{runtimeStatus === "playable" ? "Работи в автоматична игра" : "За ръчно водене"}</span>
            {definition.isDefaultEnabled ? <span>Стартова игра</span> : null}
            <span>Стойност {formatValue(definition.value)}</span>
            <span>{definition.nightOrder === null ? "Без нощен ред" : `Нощен ред ${definition.nightOrder}`}</span>
            <span>{definition.minPlayers}+ играчи</span>
            <span>{definition.maxCopies === 1 ? "1 копие" : `До ${definition.maxCopies} копия`}</span>
            {definition.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          {definition.dependencies.length > 0 ? (
            <div className="role-warning">
              {definition.dependencies.map((dependency) => (
                <span key={dependency.roleId}>{dependency.reasonBg}</span>
              ))}
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}

function compareRoles(left: RoleCode, right: RoleCode) {
  const leftDefinition = ROLE_DEFINITIONS[left];
  const rightDefinition = ROLE_DEFINITIONS[right];
  const leftOrder = leftDefinition.nightOrder ?? 100;
  const rightOrder = rightDefinition.nightOrder ?? 100;

  if (leftDefinition.team !== rightDefinition.team) {
    return teamRank(leftDefinition.team) - teamRank(rightDefinition.team);
  }
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return leftDefinition.nameBg.localeCompare(rightDefinition.nameBg, "bg");
}

function teamRank(team: string) {
  if (team === "village") {
    return 0;
  }
  if (team === "werewolves" || team === "mafia") {
    return 1;
  }
  if (team === "vampires") {
    return 2;
  }
  if (team === "lovers") {
    return 3;
  }
  return 4;
}

function formatValue(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

const roleFilterOptions: Array<[RoleFilter, string]> = [
  ["all", "Всички"],
  ["starter", "Стартови"],
  ["advanced", "Разширени"],
  ["night", "Нощни"],
  ["large", "12+ играчи"],
];

function teamFilterOptions(family: GameFamily): Array<[TeamFilter, string]> {
  return family === "mafia"
    ? [
        ["all", "Всички отбори"],
        ["town", "Град"],
        ["evil", "Мафия"],
        ["neutral", "Неутрални"],
        ["lovers", "Влюбени"],
      ]
    : [
        ["all", "Всички отбори"],
        ["town", "Село"],
        ["evil", "Върколаци"],
        ["vampires", "Вампири"],
        ["lovers", "Влюбени"],
        ["neutral", "Неутрални"],
      ];
}

function matchesRoleFilter(role: RoleCode, filter: RoleFilter) {
  const definition = ROLE_DEFINITIONS[role];
  if (filter === "starter") {
    return definition.isDefaultEnabled;
  }
  if (filter === "advanced") {
    return ("advanced" in definition && Boolean(definition.advanced)) || getRoleRuntimeStatus(role) !== "playable";
  }
  if (filter === "large") {
    return definition.minPlayers >= 12;
  }
  if (filter === "night") {
    return definition.nightAction;
  }
  return true;
}

function matchesTeamFilter(role: RoleCode, filter: TeamFilter) {
  const team = ROLE_DEFINITIONS[role].team;
  if (filter === "town") {
    return team === "village";
  }
  if (filter === "evil") {
    return team === "werewolves" || team === "mafia";
  }
  if (filter === "vampires") {
    return team === "vampires";
  }
  if (filter === "lovers") {
    return team === "lovers";
  }
  if (filter === "neutral") {
    return team === "neutral";
  }
  return true;
}

function matchesRoleSearch(role: RoleCode, query: string) {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) {
    return true;
  }

  const definition = ROLE_DEFINITIONS[role];
  const haystack = normalizeSearch(
    `${role} ${definition.nameBg} ${definition.shortDescriptionBg} ${definition.fullDescriptionBg} ${definition.tags.join(" ")}`,
  );
  return haystack.includes(normalizedQuery);
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .replaceAll("а", "a")
    .replaceAll("б", "b")
    .replaceAll("в", "v")
    .replaceAll("г", "g")
    .replaceAll("д", "d")
    .replaceAll("е", "e")
    .replaceAll("ж", "zh")
    .replaceAll("з", "z")
    .replaceAll("и", "i")
    .replaceAll("й", "y")
    .replaceAll("к", "k")
    .replaceAll("л", "l")
    .replaceAll("м", "m")
    .replaceAll("н", "n")
    .replaceAll("о", "o")
    .replaceAll("п", "p")
    .replaceAll("р", "r")
    .replaceAll("с", "s")
    .replaceAll("т", "t")
    .replaceAll("у", "u")
    .replaceAll("ф", "f")
    .replaceAll("х", "h")
    .replaceAll("ц", "ts")
    .replaceAll("ч", "ch")
    .replaceAll("ш", "sh")
    .replaceAll("щ", "sht")
    .replaceAll("ъ", "a")
    .replaceAll("ь", "y")
    .replaceAll("ю", "yu")
    .replaceAll("я", "ya")
    .replace(/[^a-z0-9а-я]+/gi, " ")
    .trim();
}

function roleQuoteBg(role: RoleCode, family: GameFamily) {
  const quotes: Partial<Record<RoleCode, string>> = {
    seer: "Картите казват истината, но не казват кога да я кажеш.",
    oracle: "Истината идва на части. Паниката я прави безполезна.",
    hunter: "Когато падаш, един от тях пада с теб.",
    witch: "Една отвара спасява нощта. Другата я приключва.",
    healer: "Най-добрата защита е тази, за която никой не разбира.",
    priest: "Благословията е тиха, но остава до края.",
    werewolf: "Селото спи. Гората брои.",
    vampire: "Не всяка смърт идва сутрин.",
    mafioso: "Спите в хор. Лъжете поотделно.",
    don: "Не командваш силно. Командваш така, че да изглежда случайно.",
    commissioner: "Проверката е оръжие само ако оцелееш да я използваш.",
    doctor: "Понякога спасяваш човека, който утре ще те обвини.",
    jester: "Истинската победа е всички да сбъркат по твоя план.",
  };

  return quotes[role] ?? (family === "mafia" ? "В този град всяко алиби има цена." : "В това село тишината също говори.");
}

function roleStrategyBg(role: RoleCode, family: GameFamily) {
  const definition = ROLE_DEFINITIONS[role];
  if (definition.team === "mafia" || definition.team === "werewolves" || definition.team === "vampires") {
    return family === "mafia"
      ? "Стратегия: говори рано, но не води всяко гласуване. Най-доброто алиби е малко несъвършено."
      : "Стратегия: не се защитавай като отбор. Остави селото само да построи грешната история.";
  }
  if (hasRoleTag(role, "разследваща")) {
    return "Стратегия: събирай информация бавно. Дай намек, не лекция, докато нямаш достатъчно връзки.";
  }
  if (hasRoleTag(role, "защитна")) {
    return "Стратегия: пази хората, които събират доверие, не най-шумните. Шумът често е капан.";
  }
  if (hasRoleTag(role, "атакуваща")) {
    return "Стратегия: стреляй само когато имаш причина, която можеш да защитиш след това.";
  }
  if (definition.team === "neutral" || definition.team === "lovers") {
    return "Стратегия: не играеш по общия ритъм на масата. Използвай хаоса, но не го прави очевиден.";
  }
  return "Стратегия: гледай как хората гласуват, не само какво казват. Гласуването помни повече от речта.";
}

function roleCounterplayBg(role: RoleCode, family: GameFamily) {
  const definition = ROLE_DEFINITIONS[role];
  if (definition.team === "mafia" || definition.team === "werewolves" || definition.team === "vampires") {
    return family === "mafia"
      ? "Срещу нея: търси резки смени на версията и прекалено удобни обвинения."
      : "Срещу нея: следи кой оставя подозренията да работят вместо него.";
  }
  if (hasRoleTag(role, "разследваща")) {
    return "Срещу нея: истинската информация често идва с колебание, фалшивата — с прекалена увереност.";
  }
  if (hasRoleTag(role, "защитна")) {
    return "Срещу нея: ако няма смърт, не приемай автоматично, че защитникът е доказан.";
  }
  if (hasRoleTag(role, "атакуваща")) {
    return "Срещу нея: притискай причината за избора, не само резултата.";
  }
  if (role === "jester") {
    return "Срещу нея: ако някой прекалено много иска да бъде изгонен, може би му помагате.";
  }
  return "Срещу нея: обикновената роля печели с търпение. Не я подценявай в края.";
}

function hasRoleTag(role: RoleCode, tag: string) {
  return (ROLE_DEFINITIONS[role].tags as readonly string[]).includes(tag);
}
