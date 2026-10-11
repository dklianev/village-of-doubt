import { useId, type KeyboardEvent, type RefObject } from "react";
import { NARRATOR_VOICE_LABELS_BG, ROLE_DEFINITIONS, getGameFamily, type RoleCode } from "@werewolf/shared";
import { communicationBg, majorityModeBg, modeBg, narratorBg, tempoBg } from "@/lib/play/copy";
import { phaseGuideBg, roleWakeHint } from "@/lib/play/phase-guide";
import { roleThumbStyle } from "@/lib/role-art";
import type { GameSnapshot, PublicPlayer } from "@/lib/play/types";
import PlayToolSurface from "./PlayToolSurface";
import styles from "./PlayTools.module.css";

const TABS = ["Текуща фаза", "Правила", "Състав"];

export default function PlayReferenceContent({ snapshot, privateRole, ownPlayer, open, onOpenChange, trigger, tab, setTab }: {
  snapshot: GameSnapshot;
  privateRole: RoleCode | undefined;
  ownPlayer: PublicPlayer | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: RefObject<HTMLButtonElement | null>;
  tab: number;
  setTab: (tab: number) => void;
}) {
  const id = useId();
  const guide = phaseGuideBg(snapshot.phase, snapshot.mode);
  const metrics = [
    ["Режим", modeBg(snapshot.mode)],
    ["Темпо", tempoBg(snapshot.tempoProfile)],
    ["Разказвач", narratorBg(snapshot.narratorMode)],
    ["Разговор", communicationBg(snapshot.communicationMode)],
    ["Дискусия", snapshot.dayDiscussionSeconds ? `${snapshot.dayDiscussionSeconds} сек.` : "Без таймер"],
    ["Гласуване", snapshot.voteSeconds ? `${snapshot.voteSeconds} сек.` : "Без таймер"],
    ["Мнозинство", majorityModeBg(snapshot.majorityMode)],
    ["Пропускане на глас", snapshot.allowSkipVote ? "Разрешено" : "Не е разрешено"],
    ["Глас на Разказвача", NARRATOR_VOICE_LABELS_BG[snapshot.narratorVoice]],
  ];

  function navigateTabs(event: KeyboardEvent<HTMLDivElement>) {
    let next = tab;
    if (event.key === "ArrowRight") next = (tab + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (tab + TABS.length - 1) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    setTab(next);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  return (
      <PlayToolSurface open={open} onOpenChange={onOpenChange} title="Правила на масата" trigger={trigger}>
        <div className={styles.referenceBody}>
          <div className={styles.tabs} role="tablist" aria-label="Справка за играта" onKeyDown={navigateTabs}>
            {TABS.map((label, index) => (
              <button key={label} id={`${id}-tab-${index}`} role="tab" type="button" aria-selected={tab === index}
                aria-controls={`${id}-panel-${index}`} tabIndex={tab === index ? 0 : -1} onClick={() => setTab(index)}>{label}</button>
            ))}
          </div>
          {TABS.map((label, index) => (
            <div key={label} className={styles.reading} role="tabpanel" id={`${id}-panel-${index}`}
              aria-labelledby={`${id}-tab-${index}`} hidden={tab !== index} tabIndex={0}>
              {index === 0 ? (
                <>
                  <p className={styles.eyebrow}>Текуща фаза</p>
                  <h3>{guide.title}</h3><p>{guide.body}</p>
                  <dl className={styles.phaseNotes}>
                    <div><dt>Кой е на ход</dt><dd>{guide.wakes}</dd></div>
                    <div><dt>За теб</dt><dd>{roleWakeHint(privateRole, snapshot.phase, ownPlayer)}</dd></div>
                  </dl>
                </>
              ) : index === 1 ? (
                <>
                  <dl className={styles.metrics}>{metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
                  {snapshot.narratorMode === "full_human" ? <p className={styles.note}>Пълният Разказвач вижда всички роли и действия.</p> : null}
                </>
              ) : (
                <>
                  <h3>Роли в стаята</h3><p>{snapshot.players.filter((player) => player.playing).length} играчи</p>
                  <ul className={styles.roster}>
                    {snapshot.roleCounts.map(({ role, count }) => (
                      <li key={role}>
                        <span className={styles.portrait} aria-hidden="true" style={roleThumbStyle(getGameFamily(snapshot.mode), role)} />
                        <span>{ROLE_DEFINITIONS[role]?.nameBg ?? role}</span><strong>{count}</strong>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      </PlayToolSurface>
  );
}
