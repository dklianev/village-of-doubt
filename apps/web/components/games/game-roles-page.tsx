import { ROLE_DEFINITIONS, getRoleAssetKey, getRolesForFamily, teamLabelBg, type GameFamily, type RoleCode } from "@werewolf/shared";

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
  "little-girl",
  "thief",
  "mayor",
]);

const KNOWN_MAFIA_ROLE_ASSETS = new Set(["civilian", "commissioner", "don", "mafioso"]);

export function GameRolesPage({ family }: { family: GameFamily }) {
  const isMafia = family === "mafia";
  const title = isMafia ? "Роли в Мафия" : "Роли във Върколак";
  const intro = isMafia
    ? "Отделен справочник само за Мафия: градски роли, Мафия и неутрални варианти със собствен речник."
    : "Справочник по ролите за Върколак, базиран на „Върколаци — Голяма кутия“, със стойности, зависимости и нощен ред.";
  const roles = getRolesForFamily(family).sort(compareRoles);

  return (
    <main className="shell roles-shell" data-theme={family} data-family={family}>
      <section className="card role-codex-hero rounded-[2rem] p-7">
        <p className="section-kicker">{isMafia ? "досиета на града" : "книга на персонажите"}</p>
        <h1 className="mt-3 text-5xl font-black leading-none md:text-7xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#ead9ba]">{intro}</p>
      </section>

      <div className="role-codex-grid mt-6">
        {roles.map((role) => {
          const definition = ROLE_DEFINITIONS[role];
          return (
            <article key={role} className={`role-codex-card role-${role}`}>
              <RoleArt role={role} family={family} />
              <div className="role-codex-copy">
                <p className="section-kicker text-[#842f2b]">{teamLabelBg(definition.team, family)}</p>
                <h2>{definition.nameBg}</h2>
                <p>{definition.shortDescriptionBg}</p>
                <p className="role-codex-full">{definition.fullDescriptionBg}</p>
                <div className="role-codex-tags">
                  <span>Стойност {formatValue(definition.value)}</span>
                  <span>{definition.nightOrder === null ? "Без нощен ред" : `Нощен ред ${definition.nightOrder}`}</span>
                  <span>{definition.nightAction ? "Нощно действие" : "Без нощно действие"}</span>
                  {definition.tags.slice(0, 3).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                {definition.dependencies.length > 0 ? (
                  <div className="role-warning mt-4">
                    {definition.dependencies.map((dependency) => (
                      <span key={dependency.roleId}>{dependency.reasonBg}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}

function RoleArt({ role, family }: { role: RoleCode; family: GameFamily }) {
  const assetKey = getRoleAssetKey(role);
  const hasAsset =
    family === "mafia" ? KNOWN_MAFIA_ROLE_ASSETS.has(assetKey) : KNOWN_WEREWOLF_ROLE_ASSETS.has(assetKey);
  const prefix = family === "mafia" ? "/game-art/mafia" : "/game-art";
  const slug = hasAsset ? `role-${assetKey}` : "card-back-secret";

  return (
    <picture className="role-codex-art" aria-hidden="true">
      <source srcSet={`${prefix}/${slug}.webp`} type="image/webp" />
      <img src={`${prefix}/${slug}.png`} alt="" loading="lazy" width={640} height={896} />
    </picture>
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
