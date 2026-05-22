import { ROLE_DEFINITIONS, getRoleShortDescriptionBg, teamLabelBg, type RoleCode } from "@werewolf/shared";
import { ROLE_GUIDE_BG, formatPrivateResult } from "@/lib/play/copy";
import { roleSigil } from "@/lib/play/player-display";
import type { PrivateResult, PublicPlayer } from "@/lib/play/types";

export function RoleCard({
  role,
  result,
  players,
}: {
  role: { role: RoleCode; roleNameBg: string } | null;
  result: PrivateResult | null;
  players: PublicPlayer[];
}) {
  if (!role) {
    return null;
  }

  const definition = ROLE_DEFINITIONS[role.role];
  const family = definition.availableInFamilies[0] ?? "werewolves";
  const guide = ROLE_GUIDE_BG[role.role] ?? {
    summary: getRoleShortDescriptionBg(role.role),
    team: teamLabelBg(definition.team, family),
    timing: definition.nightAction ? "Нощна фаза" : "Ден и гласуване",
    win: "winConditionBg" in definition ? definition.winConditionBg : "Следвай целта на своя отбор",
  };

  return (
    <article className={`role-card paper-card mt-8 rounded-[2rem] p-6 role-${role.role}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-kicker text-[#842f2b]">само за теб</p>
          <h2 className="mt-2 text-4xl font-black">{role.roleNameBg}</h2>
        </div>
        <div className="role-sigil" aria-hidden="true">
          {roleSigil(role.role)}
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        <p className="text-[#4f3829]">{guide.summary}</p>
        <div className="grid gap-3 md:grid-cols-3">
          <RoleFact label="Отбор" value={guide.team} />
          <RoleFact label="Кога действа" value={guide.timing} />
          <RoleFact label="Цел" value={guide.win} />
        </div>
      </div>
      <p className="mt-4 rounded-2xl bg-[#221611]/10 px-4 py-3 text-sm font-bold text-[#4f3829]">
        Сигурност: чуждите тайни роли не са в публичния state и не трябва да се виждат през DevTools/network.
      </p>
      {result ? (
        <p className="mt-4 rounded-2xl bg-[#842f2b]/10 px-4 py-3 text-[#4f3829]">
          {formatPrivateResult(result, players)}
        </p>
      ) : null}
    </article>
  );
}

function RoleFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/35 px-4 py-3">
      <span className="block text-xs uppercase tracking-[0.2em] text-[#842f2b]">{label}</span>
      <strong className="mt-1 block text-[#221611]">{value}</strong>
    </div>
  );
}
