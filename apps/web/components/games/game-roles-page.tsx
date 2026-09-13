"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { memo, Suspense, useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import "@/components/games/GameRolesPage.module.css";
import {
  ROLE_DEFINITIONS,
  getRoleRuntimeStatus,
  getRolesForFamily,
  teamLabelBg,
  type GameFamily,
  type RoleCode,
} from "@werewolf/shared";
import { RoleArt } from "./RoleArt";
import { RoleDossier } from "./RoleDossier";

type RoleFilter = "all" | "starter" | "advanced" | "night" | "large";
type TeamFilter = "all" | "town" | "evil" | "vampires" | "lovers" | "neutral";
type RoleSort = "core" | "team" | "night";

const CORE_ROLES: Record<GameFamily, readonly RoleCode[]> = {
  werewolves: ["ordinary_villager", "werewolf", "seer", "healer", "witch", "hunter"],
  mafia: ["civilian", "mafioso", "commissioner", "doctor", "don"],
};


const ROLE_HAYSTACK_CACHE = new Map<RoleCode, string>();
const CYRILLIC_SEARCH_MAP: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ж: "zh",
  з: "z",
  и: "i",
  ѝ: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sht",
  ъ: "a",
  ь: "y",
  ю: "yu",
  я: "ya",
};
const CYRILLIC_SEARCH_PATTERN = /[а-яѝ]/g;

export function GameRolesPage({ family }: { family: GameFamily }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [sort, setSort] = useState<RoleSort>("core");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleCode | null>(null);
  const catalogRef = useRef<HTMLElement>(null);
  const filtersId = useId();
  const sortId = useId();
  const deferredQuery = useDeferredValue(query);
  const isMafia = family === "mafia";
  const title = isMafia ? "Роли в Мафия" : "Роли във Върколак";
  const intro = isMafia
    ? "Бърз справочник за града: кой разследва, кой пази и кой дърпа конците след полунощ."
    : "Бърз справочник за селото: кой вижда, кой лъже и кои роли обръщат нощта.";
  const allRoles = useMemo(
    () => [...getRolesForFamily(family)].sort((left, right) => compareRoles(left, right, sort, family)),
    [family, sort],
  );
  const activeFilterCount = Number(filter !== "all") + Number(teamFilter !== "all") + Number(sort !== "core");
  const normalizedQuery = useMemo(() => normalizeSearch(deferredQuery), [deferredQuery]);
  const roles = useMemo(
    () =>
      allRoles
        .filter((role) => matchesRoleFilter(role, filter))
        .filter((role) => matchesTeamFilter(role, teamFilter))
        .filter((role) => matchesRoleSearch(role, normalizedQuery)),
    [allRoles, filter, normalizedQuery, teamFilter],
  );
  const selectRole = useCallback((role: RoleCode) => {
    setSelectedRole(role);
  }, []);
  const selectLinkedRole = useCallback((role: RoleCode | null) => {
    const catalog = catalogRef.current;
    if (role && catalog && !document.querySelector("[data-role-dossier]")) {
      // Give the dossier a catalogue focus target when there was no local click.
      const target = catalog.querySelector<HTMLButtonElement>(`.role-${role} button`)
        ?? catalog.querySelector<HTMLInputElement>(".role-search-input");
      target?.focus({ preventScroll: true });
    }
    setSelectedRole(role);
  }, []);
  const closeRole = useCallback(() => {
    setSelectedRole(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("role")) {
      url.searchParams.delete("role");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);
  const resetFilters = useCallback(() => {
    setQuery("");
    setFilter("all");
    setTeamFilter("all");
    setSort("core");
  }, []);

  return (
    <main ref={catalogRef} className="shell roles-shell" data-faction={family} data-family={family}>
      <Suspense fallback={null}>
        <RoleCatalogDeepLink family={family} onSelect={selectLinkedRole} />
      </Suspense>
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
          <Search size={18} aria-hidden="true" />
          <input
            className="role-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={isMafia ? "Търси: лекар, дон, шут..." : "Търси: вампир, лечител, оракул..."}
            aria-label="Търси роля"
          />
        </div>
        <button
          type="button"
          className="role-filters-toggle"
          aria-expanded={filtersExpanded}
          aria-controls={filtersId}
          aria-label={`Филтри и подредба${activeFilterCount ? `, ${activeFilterCount} активни` : ""}`}
          onClick={() => setFiltersExpanded((expanded) => !expanded)}
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          Филтри и подредба
          {activeFilterCount > 0 ? <span className="role-filter-count">{activeFilterCount}</span> : null}
          <ChevronDown size={18} aria-hidden="true" />
        </button>
        <div className="role-filter-stack" id={filtersId} data-expanded={filtersExpanded}>
          <label className="role-sort" htmlFor={sortId}>
            <span>Подредба</span>
            <select id={sortId} value={sort} onChange={(event) => setSort(event.target.value as RoleSort)}>
              <option value="core">Основни роли първо</option>
              <option value="team">По отбор</option>
              <option value="night">Нощен ред</option>
            </select>
          </label>
          <div className="role-filter-chips" role="group" aria-label="Тип роли">
            {roleFilterOptions.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? "is-active" : ""}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="role-filter-chips role-team-chips" role="group" aria-label="Отбори">
            {teamFilterOptions(family).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={teamFilter === value ? "is-active" : ""}
                aria-pressed={teamFilter === value}
                onClick={() => setTeamFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="role-codex-result-line">
        <span role="status" aria-live="polite">
          Показани {roles.length} от {allRoles.length} роли
        </span>
        {query.trim().length > 0 ? <span>Търсене: “{query.trim()}”</span> : null}
        {query.trim() || activeFilterCount > 0 ? (
          <button type="button" className="role-filters-reset" onClick={resetFilters}>
            <RotateCcw size={16} aria-hidden="true" />
            Изчисти филтрите
          </button>
        ) : null}
      </div>

      <div className="role-codex-grid">
        {roles.map((role, index) => {
          return (
            <RoleCodexCard key={role} family={family} role={role} eager={index === 0} onSelect={selectRole} />
          );
        })}
      </div>
      {roles.length === 0 ? (
        <section className="role-codex-empty">
          <div>
            <h2>Няма роля по този филтър</h2>
            <p>Пробвай с друго име или върни филтъра на “Всички”.</p>
          </div>
          <button type="button" className="role-codex-empty-action" onClick={resetFilters}>
            Покажи всички роли
          </button>
        </section>
      ) : null}
      {selectedRole ? <RoleDossier family={family} role={selectedRole} onClose={closeRole} /> : null}
    </main>
  );
}

function RoleCatalogDeepLink({ family, onSelect }: {
  family: GameFamily;
  onSelect: (role: RoleCode | null) => void;
}) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const values = searchParams?.getAll("role") ?? [];
    const role = values.length === 1
      ? getRolesForFamily(family).find((candidate) => candidate === values[0]) ?? null
      : null;
    onSelect(role);
  }, [family, onSelect, searchParams]);
  return null;
}

const RoleCodexCard = memo(function RoleCodexCard({
  family,
  role,
  eager,
  onSelect,
}: {
  family: GameFamily;
  role: RoleCode;
  eager: boolean;
  onSelect: (role: RoleCode) => void;
}) {
  const definition = ROLE_DEFINITIONS[role];
  const runtimeStatus = getRoleRuntimeStatus(role);

  return (
    <article className={`role-codex-card role-codex-card-compact role-${role}`}>
      <button type="button" className="role-codex-card-button" aria-haspopup="dialog" onClick={() => onSelect(role)}>
        <RoleArt role={role} family={family} eager={eager} />
        <div className="role-codex-copy">
          <div className="role-codex-card-topline">
            <span>{teamLabelBg(definition.team, family)}</span>
          </div>
          <h2 className="role-card-title">{definition.nameBg}</h2>
          <p>{definition.shortDescriptionBg}</p>
          <div className="role-codex-tags" aria-label="Данни за ролята">
            {runtimeStatus !== "playable" ? <span>Ръчно водене</span> : null}
            {definition.isDefaultEnabled ? <span>Стартова</span> : null}
            <span>{definition.nightAction ? "Нощна способност" : "Без нощно действие"}</span>
          </div>
          <span className="role-codex-open">За ролята <ArrowUpRight size={16} aria-hidden="true" /></span>
        </div>
      </button>
    </article>
  );
});


function compareRoles(left: RoleCode, right: RoleCode, sort: RoleSort, family: GameFamily) {
  const leftDefinition = ROLE_DEFINITIONS[left];
  const rightDefinition = ROLE_DEFINITIONS[right];
  const leftOrder = leftDefinition.nightOrder ?? 100;
  const rightOrder = rightDefinition.nightOrder ?? 100;

  if (sort === "core") {
    const coreRoles = CORE_ROLES[family];
    const leftCore = coreRoles.indexOf(left);
    const rightCore = coreRoles.indexOf(right);
    const coreDifference = (leftCore < 0 ? coreRoles.length : leftCore) - (rightCore < 0 ? coreRoles.length : rightCore);
    if (coreDifference !== 0) return coreDifference;
    if (leftDefinition.isDefaultEnabled !== rightDefinition.isDefaultEnabled) {
      return Number(rightDefinition.isDefaultEnabled) - Number(leftDefinition.isDefaultEnabled);
    }
  }
  if (sort === "night" && leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
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

function matchesRoleSearch(role: RoleCode, normalizedQuery: string) {
  if (!normalizedQuery) {
    return true;
  }

  return getRoleHaystack(role).includes(normalizedQuery);
}

function getRoleHaystack(role: RoleCode) {
  const cached = ROLE_HAYSTACK_CACHE.get(role);
  if (cached) {
    return cached;
  }
  const definition = ROLE_DEFINITIONS[role];
  const haystack = normalizeSearch(
    `${role} ${definition.nameBg} ${definition.shortDescriptionBg} ${definition.fullDescriptionBg} ${definition.tags.join(" ")}`,
  );
  ROLE_HAYSTACK_CACHE.set(role, haystack);
  return haystack;
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .replace(CYRILLIC_SEARCH_PATTERN, (letter) => CYRILLIC_SEARCH_MAP[letter] ?? letter)
    .replace(/[^a-z0-9а-я]+/gi, " ")
    .trim();
}
