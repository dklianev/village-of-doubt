import { NARRATOR_VOICE_LABELS_BG, ROLE_DEFINITIONS, getGameFamily } from "@werewolf/shared";
import { SummaryPill } from "@/components/play/SummaryPill";
import { communicationBg, majorityModeBg, modeBg, narratorBg, tempoBg } from "@/lib/play/copy";
import { roleThumbStyle } from "@/lib/role-art";
import type { GameSnapshot } from "@/lib/play/types";

export function RulesSummary({ snapshot }: { snapshot: GameSnapshot }) {
  return (
    <section className="ritual-panel mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">правила преди старт</p>
      <div className="rules-summary-metrics-grid mt-4 grid gap-3 md:grid-cols-2">
        <SummaryPill label="Режим" value={modeBg(snapshot.mode)} />
        <SummaryPill
          label="Играчи"
          value={`${snapshot.players.filter((player) => player.playing).length}/${snapshot.playerCount}`}
        />
        <SummaryPill label="Разказвач" value={narratorBg(snapshot.narratorMode)} />
        <SummaryPill label="Комуникация" value={communicationBg(snapshot.communicationMode)} />
        <SummaryPill label="Темпо" value={tempoBg(snapshot.tempoProfile)} />
        <SummaryPill label="Ден/гласуване" value={`${snapshot.dayDiscussionSeconds}s / ${snapshot.voteSeconds}s`} />
        <SummaryPill label="Глас" value={NARRATOR_VOICE_LABELS_BG[snapshot.narratorVoice]} />
        <SummaryPill label="Гласуване" value={`${snapshot.allowSkipVote ? "може пропуск" : "без пропуск"} · ${majorityModeBg(snapshot.majorityMode)}`} />
      </div>

      <h3 className="rules-summary-roles-heading">Роли в стаята</h3>
      <div className="rules-summary-roles-grid mt-3 grid gap-3 md:grid-cols-2">
        {snapshot.roleCounts.map((item) => (
          <div key={item.role} className={`role-count-chip role-${item.role} is-dark`}>
            <dt>
              <span className="role-count-art" aria-hidden="true" style={roleThumbStyle(getGameFamily(snapshot.mode), item.role)} />
              <span>{ROLE_DEFINITIONS[item.role]?.nameBg ?? item.role}</span>
            </dt>
            <dd>{item.count}</dd>
          </div>
        ))}
      </div>

      {snapshot.narratorMode === "full_human" ? (
        <p className="mt-4 rounded-2xl bg-[#842f2b]/25 p-4 font-bold text-[#fff6e5]">
          В тази стая Пълният Разказвач вижда всички роли и действия.
        </p>
      ) : null}
    </section>
  );
}
